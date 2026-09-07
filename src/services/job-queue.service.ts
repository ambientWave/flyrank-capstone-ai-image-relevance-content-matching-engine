/**First I went for kafka by using kafkajs but later I moved to redis and bullmq after
 * seeing the following messsage from my conversation with claude:
 * "A Kafka topic has no native index on message key — "find the message with key X" means either
 * scanning the partition from the earliest offset (linear, gets slower as the topic grows,
 * genuinely bad fit for a live status check) or standing up a compacted topic plus
 * Kafka Streams/ksqlDB to materialize a queryable state store on top. That second option
 * is a real pattern (it's how you'd build this at actual scale) — but notice what it is: an extra system
 * whose entire purpose is turning Kafka's log back into something with point lookups. You already
 * have that system. It's Postgres, and it's already in your design. Kafka strength shows up when you need
 * to audit what had happened over a period of time, and need to replay events.
 */


import { injectable } from 'tsyringe';
import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.ts';

const visionQueue = new Queue('vision', { connection: redisConfig }); // the name should be identifier and same as the name used in worker.ts
const textEmbedQueue = new Queue('text-embed', { connection: redisConfig });

/**Simpler, fewer moving parts, genuinely fine for a lot of pipelines.
 * I'd still keep them separate for this specific project,
 * for one concrete reason that matters here more than usual:
 * cost asymmetry and retry blast radius.
 * Vision and embedding are both paid Gemini calls, tracked per-call in
 * cost_log. If tagging succeeds and embedding fails (rate limit, transient network error),
 * the merged worker's retry re-runs tagImage too, since BullMQ retries
 * the whole job — you'd re-bill a Gemini vision call that already succeeded,
 * purely because the second unrelated step failed. With separate queues,
 * a failed embed job retries only the embed step; the tag job is already completed and stays that way.
 * Two secondary reasons that are real but smaller: independent
 * concurrency tuning — Gemini's vision free tier and embeddings free tier likely have different
 * rate limits, and separate queues let you set concurrency: 5 on one and concurrency: 10 on the other;
 * a merged worker forces one concurrency setting on calls with different rate ceilings.
 * And independent status visibility — getJobStatus("vision", imageId) vs getJobStatus("embed", imageId)
 * lets you answer "did tagging fail or did embedding fail" without inspecting job internals;
 * a merged job just tells you the whole thing failed somewhere.
 */

// the direction of the arrow is fixed one way: service → job queue → worker → service, never job queue → service directly.
@injectable()
export class JobQueueService {
    async addVisionJobs(imageIds: string[]): Promise<void> {
        await visionQueue.addBulk(
            imageIds.map(id => ({
                name: 'understand-image',
                data: { imageId: id },
                opts: {
                    jobId: id,
                    attempts: 3,  // retries
                    backoff: { type: 'exponential', delay: 5000 }, // increasing delay between retries
                    removeOnComplete: 100, // keep last 100 completed jobs (to avoid memory leak in redis). 101st job will evict 1st job
                    removeOnFail: 50 // keep last 50 failed jobs (to debug)
                }
            }))
        );
    }

    async addEmbedJobs(imageIds: string[]): Promise<void> {
        await textEmbedQueue.addBulk(
            imageIds.map(id => ({
                name: "embed-image-caption",
                data: { imageId: id },
                opts: {
                    jobId: id,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: 100,
                    removeOnFail: 50
                }
            }))
        );
    }

    async getJobStatus(queue: "vision" | "embed", id: string): Promise<string> {
        const targetQueue = queue === "vision" ? visionQueue : textEmbedQueue;
        const job = await targetQueue.getJob(id);
        return job ? await job.getState() : "not_queued";
    }
}
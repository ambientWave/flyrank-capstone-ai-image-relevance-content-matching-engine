import { Worker } from 'bullmq';
import { redisConfig } from '../config/redis.ts';
import { PostDownloadService } from '../services/post-download.service.ts';
import { PostSummarizeService } from '../services/post-summarize.service.ts';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import dotenv from 'dotenv';
import { container } from '../config/container.ts';

dotenv.config();

export async function postSummarizeWorker() {
    const postDownloadService = container.resolve('PostDownloadService') as PostDownloadService;
    const postSummarizeService = container.resolve('PostSummarizeService') as PostSummarizeService;
    const orchestrator = container.resolve('IngestionOrchestratorService') as IngestionOrchestratorService;

    const worker = new Worker("post-summarize", async (job) => {
        const postId = job.data.postId;

        try {
            // PostDownloadService and PostSummarizeService handle all DB interactions
            const summary = await postSummarizeService.summarizePost(postId);
            
            await orchestrator.onPostSummarizeComplete(postId, summary);
        } catch (error) {
            console.error(`Error summarizing post ${postId}:`, error);
            // PostSummarizeService handles failed status
        }
    }, { connection: redisConfig, concurrency: 5 });

    return worker;
}
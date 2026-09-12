import { Worker } from 'bullmq';
import { redisConfig } from '../config/redis.ts';
import { TextEmbedService } from '../services/text-embed.service.ts';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import dotenv from 'dotenv';
import { container } from '../config/container.ts';

dotenv.config();

export async function textEmbedWorker() {
    const textEmbedService = container.resolve('TextEmbedService') as TextEmbedService;
    const orchestrator = container.resolve('IngestionOrchestratorService') as IngestionOrchestratorService;

    const worker = new Worker("text-embed", async (job) => {
        const imageId = job.data.imageId;
        const postId = job.data.postId;

        try {
            if (imageId) {
                await textEmbedService.embedImageCaption(imageId);
            } else if (postId) {
                await textEmbedService.embedPostSummary(postId);
            }
            // The service will handle status updates internally
            // Optionally call orchestrator.onPostEmbedComplete or similar if needed
        } catch (error) {
            const refId = imageId || postId;
            console.error(`Error embedding ${imageId ? 'image' : 'post'} ${refId}:`, error);
            // Status will be updated by the service
        }
    }, { connection: redisConfig, concurrency: 10 });

    return worker;
}
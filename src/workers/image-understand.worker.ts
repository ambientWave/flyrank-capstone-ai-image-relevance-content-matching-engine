import { Worker } from 'bullmq';
import { redisConfig } from '../config/redis.ts';
import { ImageUnderstandService } from '../services/image-understand.service.ts';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import dotenv from 'dotenv';
import { container } from '../config/container.ts';

dotenv.config();

const GEMINI_VISION_COST_PER_IMAGE = 0.000125;

export async function visionWorker() {
    const imageUnderstandService = container.resolve('ImageUnderstandService') as ImageUnderstandService;
    const orchestrator = container.resolve('IngestionOrchestratorService') as IngestionOrchestratorService;

    const worker = new Worker("vision", async (job) => {
        const imageId = job.data.imageId;

        try {
            const imageData = await imageUnderstandService.understandAndProcessImage(imageId);
            
            if (imageData) {
                await orchestrator.onImageUnderstandComplete([imageData]);
            }
        } catch (error) {
            console.error(`Error processing image ${imageId}:`, error);
            // ImageUnderstandService handles failed status
        }
    }, { connection: redisConfig, concurrency: 5 });

    return worker;
}
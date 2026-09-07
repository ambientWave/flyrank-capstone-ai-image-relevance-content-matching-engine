import { Worker } from 'bullmq';
import { redisConfig } from '../config/redis.ts';
import { ImageUnderstandService } from '../services/image-understand.service.ts';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { container } from '../config/container.ts';

dotenv.config();

const GEMINI_VISION_COST_PER_IMAGE = 0.000125;

export async function visionWorker() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const imageUnderstandService = container.resolve('ImageUnderstandService') as ImageUnderstandService;
    const orchestrator = container.resolve('IngestionOrchestratorService') as IngestionOrchestratorService;

    const worker = new Worker("vision", async (job) => {
        const imageId = job.data.imageId;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const imageResult = await client.query(
                'SELECT id, url_path, status FROM images WHERE id = $1 FOR UPDATE',
                [imageId]
            );

            if (imageResult.rows.length === 0) {
                console.log(`Image ${imageId} not found`);
                return;
            }

            const image = imageResult.rows[0];
            if (image.status === 'completed') {
                console.log(`Image ${imageId} already completed, skipping`);
                return;
            }

            await client.query(
                'UPDATE images SET status = $1, updated_at = now() WHERE id = $2',
                ['processing', imageId]
            );

            await client.query('COMMIT');

            const aiResponses = await imageUnderstandService.understandImage([image.url_path]);
            if (aiResponses.length === 0 || !aiResponses[0]?.response) {
                await updateImageStatus(pool, imageId, 'failed', 'Vision analysis failed');
                return;
            }

            const aiResponse = aiResponses[0].response!;
            const validated = await imageUnderstandService.validateSchema(image.url_path, aiResponse);
            if (validated.error && validated.error !== 'Confidence is low') {
                await updateImageStatus(pool, imageId, 'failed', validated.error);
                return;
            }

            await logCost(pool, imageId, 'vision', 1, GEMINI_VISION_COST_PER_IMAGE);

            const imageData = {
                id: imageId,
                imageUrl: image.url_path,
                tags: validated.data.tags,
                subject: aiResponse.subject,
                category: aiResponse.category,
                caption: aiResponse.caption,
                confidence: aiResponse.confidence,
            };

            await client.query('BEGIN');
            await insertImageTags(client, imageId, imageData);
            await client.query(
                'UPDATE images SET status = $1, updated_at = now() WHERE id = $2',
                ['completed', imageId]
            );
            await client.query('COMMIT');

            await orchestrator.onImageUnderstandComplete([imageData]);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error processing image ${imageId}:`, error);
            await updateImageStatus(pool, imageId, 'failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            client.release();
        }
    }, { connection: redisConfig, concurrency: 5 });

    return worker;
}

async function insertImageTags(client: any, imageId: string, data: any): Promise<void> {
    await client.query(
        `INSERT INTO image_tags (image_id, subject, category, attributes, caption, confidence, flagged, raw_response, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (image_id) DO UPDATE SET
             subject = EXCLUDED.subject,
             category = EXCLUDED.category,
             attributes = EXCLUDED.attributes,
             caption = EXCLUDED.caption,
             confidence = EXCLUDED.confidence,
             flagged = EXCLUDED.flagged,
             raw_response = EXCLUDED.raw_response`,
        [
            imageId,
            data.subject,
            data.category,
            data.tags,
            data.caption,
            data.confidence,
            data.confidence < 0.8,
            JSON.stringify(data),
        ]
    );
}

async function updateImageStatus(pool: Pool, imageId: string, status: string, error?: string): Promise<void> {
    await pool.query(
        'UPDATE images SET status = $1, updated_at = now() WHERE id = $2',
        [status, imageId]
    );
}

async function logCost(pool: Pool, refId: string, callType: 'vision' | 'embedding', tokensOrUnits: number, costUsd: number): Promise<void> {
    await pool.query(
        `INSERT INTO cost_log (call_type, ref_id, tokens_or_units, cost_usd, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [callType, refId, tokensOrUnits, costUsd]
    );
}
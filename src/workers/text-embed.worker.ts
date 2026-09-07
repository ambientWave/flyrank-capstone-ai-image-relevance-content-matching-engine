import { Worker } from 'bullmq';
import { redisConfig } from '../config/redis.ts';
import { TextEmbedService } from '../services/text-embed.service.ts';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { container } from '../config/container.ts';

dotenv.config();

const NOMIC_EMBED_COST_PER_1K_TOKENS = 0.00002;

export async function textEmbedWorker() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const textEmbedService = container.resolve('TextEmbedService') as TextEmbedService;

    const worker = new Worker("text-embed", async (job) => {
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
            if (image.status === 'embedded') {
                console.log(`Image ${imageId} already embedded, skipping`);
                return;
            }

            const tagsResult = await client.query(
                'SELECT caption, attributes FROM image_tags WHERE image_id = $1',
                [imageId]
            );

            if (tagsResult.rows.length === 0) {
                console.log(`No tags found for image ${imageId}`);
                return;
            }

            const { caption, attributes } = tagsResult.rows[0];
            const text = `${caption}, ${attributes.join(', ')}`;

            await client.query(
                'UPDATE images SET status = $1, updated_at = now() WHERE id = $2',
                ['embedding', imageId]
            );

            await client.query('COMMIT');

            await textEmbedService.embedImageCaptions([{
                imageUrl: image.url_path,
                tags: attributes,
            }]);

            await logCost(pool, imageId, 'embedding', Math.ceil(text.length / 4),
                (Math.ceil(text.length / 4) / 1000) * NOMIC_EMBED_COST_PER_1K_TOKENS);

            await client.query('BEGIN');
            await client.query(
                'UPDATE images SET status = $1, updated_at = now() WHERE id = $2',
                ['embedded', imageId]
            );
            await client.query('COMMIT');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error embedding image ${imageId}:`, error);
            await updateImageStatus(pool, imageId, 'failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            client.release();
        }
    }, { connection: redisConfig, concurrency: 10 });

    return worker;
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
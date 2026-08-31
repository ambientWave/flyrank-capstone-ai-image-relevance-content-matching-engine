import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export class ImageMetadataRepository {
    private pool: Pool;

    constructor(connectionString?: string) {
        this.pool = new Pool({
            connectionString: connectionString || process.env.DATABASE_URL
        });
    }

    public async initDB(retries = 10, delayMs = 3000): Promise<void> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.pool.query(`
                    CREATE TABLE IF NOT EXISTS "images" (
                        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        "filename" TEXT NOT NULL,
                        "storage_path" TEXT NOT NULL,
                        "created_at" timestamptz NOT NULL DEFAULT now()
                    )
                    CREATE TABLE IF NOT EXISTS "image_tags" (
                        "image_id" uuid PRIMARY KEY references images(id) on delete cascade,
                        "subject" TEXT NOT NULL,
                        "category" TEXT NOT NULL,
                        "attributes" TEXT[] NOT NULL default '{}',
                        "caption" TEXT NOT NULL,
                        "confidence" numeric(4,3) NOT NULL,
                        "flagged" boolean NOT NULL default false, -- low-confidence, never silently accepted
                        "raw_response" jsonb NOT NULL,                  -- full validated Gemini response, for audit
                        "created_at" timestamptz NOT NULL default now()
                    )
                    CREATE TABLE IF NOT EXISTS "posts" (
                        "id" uuid PRIMARY KEY default gen_random_uuid(),
                        "title" TEXT NOT NULL,
                        "body" TEXT NOT NULL,
                        "created_at" timestamptz NOT NULL DEFAULT now()
                    )
                    CREATE TABLE IF NOT EXISTS "suggestions" (
                        "id" uuid PRIMARY KEY default gen_random_uuid(),
                        "post_id" uuid NOT NULL references posts(id) on delete cascade,
                        "image_id" uuid references images(id) on delete set null, -- null = "no confident match"
                        "similarity" numeric(5,4),
                        "guard_decision" TEXT NOT NULL check (guard_decision in ('accepted','rejected','no_match')),
                        "reason" TEXT NOT NULL,
                        "status" TEXT NOT NULL default 'pending' check (status in ('pending','approved','rejected')),
                        "created_at" timestamptz NOT NULL DEFAULT now()
                    )
                    CREATE TABLE IF NOT EXISTS "cost_log" (
                        "id" uuid PRIMARY KEY default gen_random_uuid(),
                        "call_type" TEXT NOT NULL check (call_type in ('vision','embedding')),
                        "ref_id" uuid NOT NULL,       -- image_id or post_id
                        "tokens_or_units" numeric NOT NULL,
                        "cost_usd" numeric(10,6) NOT NULL,
                        "created_at" timestamptz NOT NULL DEFAULT now()
                    )
                `);

                console.log('[Database] Images table initialized and ready.');
                return;
            } catch (err) {
                console.error(`[Database] Init attempt ${attempt}/${retries} failed. Retrying in ${delayMs / 1000}s...`);
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                } else {
                    console.error('[Database] All initialization attempts failed.');
                    /**
                     * If all 10 retries fail → throw err → unhandled rejection → process crashes with non-zero exit
                     * restart: on-failure in compose.yaml,
                     * Docker automatically restarts the api container
                     */
                    throw err;
                }
            }
        }
    }
}
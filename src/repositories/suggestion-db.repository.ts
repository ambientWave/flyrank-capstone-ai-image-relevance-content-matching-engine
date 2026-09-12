import { injectable } from 'tsyringe';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export interface SuggestionRowPreInsertion {
    post_id: string | null;
    image_id: string | null;
    similarity: number;
    guard_decision: string;
    reason: string;
    status: string;
}

export interface SuggestionRow {
    id: string;
    post_id: string | null;
    image_id: string | null;
    similarity: number;
    guard_decision: string;
    reason: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface SuggestionRowFilter {
    post_id?: string | null;
    image_id?: string | null;
    similarity?: number;
    guard_decision?: string;
    reason?: string;
    status?: string;
}

export interface SuggestionRepository {
    findAll(): Promise<SuggestionRow[]>;
    findById(id: number): Promise<SuggestionRow | undefined>;
    insert(image: SuggestionRow): Promise<SuggestionRow>;
    update(id: number, image: SuggestionRow): Promise<SuggestionRow | null>;
    delete(id: number): Promise<boolean>;
}

@injectable()
export class SuggestionDBRepository {
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
                    CREATE TABLE IF NOT EXISTS suggestion (
                        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        post_id         UUID NOT NULL REFERENCES "post"(id) ON DELETE CASCADE,
                        image_id        UUID REFERENCES "image"(id) ON DELETE SET NULL, -- null = "no confident match"
                        similarity      NUMERIC(5,4),
                        guard_decision  TEXT NOT NULL CHECK (guard_decision IN ('accepted','rejected','no_match')),
                        reason          TEXT NOT NULL,
                        status          TEXT NOT NULL DEFAULT 'pending' CHECK (status in ('pending','approved','rejected')),
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                        );
                    CREATE INDEX IF NOT EXISTS suggestion_post_id_idx ON suggestion (post_id);
                    CREATE INDEX IF NOT EXISTS suggestion_status_idx ON suggestion (status);
                `);
                console.log('[Database] suggestion table initialized and ready.');
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

    async findAll(filter?: SuggestionRowFilter): Promise<SuggestionRow[]> {
        const conditions: string[] = [];
        const params: (string | number)[] = [];

        if (filter?.post_id !== undefined && filter?.post_id !== null) {
            conditions.push(`post_id = $${params.length + 1}`);
            params.push(filter.post_id);
        }

        if (filter?.image_id !== undefined && filter?.image_id !== null) {
            conditions.push(`image_id = $${params.length + 1}`);
            params.push(filter.image_id);
        }

        if (filter?.similarity !== undefined && filter?.similarity !== null) {
            conditions.push(`similarity = $${params.length + 1}`);
            params.push(filter.similarity);
        }

        if (filter?.guard_decision !== undefined && filter?.guard_decision !== null) {
            conditions.push(`guard_decision = $${params.length + 1}`);
            params.push(filter.guard_decision);
        }

        if (filter?.reason !== undefined && filter?.reason !== null) {
            conditions.push(`reason = $${params.length + 1}`);
            params.push(filter.reason);
        }

        if (filter?.status !== undefined && filter?.status !== null) {
            conditions.push(`status = $${params.length + 1}`);
            params.push(filter.status);
        }

        let sql = 'SELECT id, post_id, image_id, similarity, guard_decision, reason, status, created_at, updated_at FROM suggestion';
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        sql += ' ORDER BY created_at ASC, id ASC';

        const result = await this.pool.query<SuggestionRow>(sql, params);
        return result.rows;
    }

    async findByIds(ids: string[]): Promise<SuggestionRow[] | undefined> {
        const result = await this.pool.query<SuggestionRow>(
            'SELECT id, post_id, image_id, similarity, guard_decision, reason, status, created_at, updated_at FROM suggestion WHERE id = ANY($1::uuid[])',
            [ids]
        );
        const suggestions: SuggestionRow[] = [];
        for (const id of ids) {
            const suggestion = result.rows.find((suggestion) => suggestion.id === id);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }
        return suggestions;
    }

    async insert(suggestions: SuggestionRowPreInsertion[]): Promise<SuggestionRow[]> {
        if (!suggestions || suggestions.length === 0) return [];

        const post_ids = suggestions.map(i => i.post_id);
        const image_ids = suggestions.map(i => i.image_id);
        const similarities = suggestions.map(i => i.similarity);
        const guard_decisions = suggestions.map(i => i.guard_decision);
        const reasons = suggestions.map(i => i.reason);
        const statuses = suggestions.map(i => i.status);
        const created_ats = suggestions.map(() => new Date().toISOString());
        const updated_ats = suggestions.map(() => new Date().toISOString());

        const result = await this.pool.query<SuggestionRow>(
            `INSERT INTO suggestion (post_id, image_id, similarity, guard_decision, reason, status, created_at, updated_at) 
             SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::numeric[], $4::text[], $5::text[], $6::text[], $7::timestamptz[], $8::timestamptz[])
             RETURNING id, post_id, image_id, similarity, guard_decision, reason, status, created_at, updated_at`,
            [post_ids, image_ids, similarities, guard_decisions, reasons, statuses, created_ats, updated_ats]
        );
        return result.rows;
    }

    async update(ids: string[], changes: Partial<{ image_id: string | null, similarity: number, guard_decision: string, reason: string, status: string }>): Promise<SuggestionRow[]> {
        if (!ids || ids.length === 0) return [];

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (changes.image_id !== undefined) {
            updates.push(`image_id = $${paramIndex++}`);
            params.push(changes.image_id);
        }
        if (changes.similarity !== undefined) {
            updates.push(`similarity = $${paramIndex++}`);
            params.push(changes.similarity);
        }
        if (changes.guard_decision !== undefined) {
            updates.push(`guard_decision = $${paramIndex++}`);
            params.push(changes.guard_decision);
        }
        if (changes.reason !== undefined) {
            updates.push(`reason = $${paramIndex++}`);
            params.push(changes.reason);
        }
        if (changes.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(changes.status);
        }

        if (updates.length === 0) {
            return (await this.findByIds(ids)) || [];
        }

        updates.push(`updated_at = $${paramIndex++}`);
        params.push(new Date().toISOString());

        params.push(ids);

        const sql = `
            UPDATE suggestion 
            SET ${updates.join(', ')} 
            WHERE id = ANY($${paramIndex}::uuid[]) 
            RETURNING id, post_id, image_id, similarity, guard_decision, reason, status, created_at, updated_at
        `;

        const result = await this.pool.query<SuggestionRow>(sql, params);
        return result.rows;
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.pool.query('DELETE FROM suggestion WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
}
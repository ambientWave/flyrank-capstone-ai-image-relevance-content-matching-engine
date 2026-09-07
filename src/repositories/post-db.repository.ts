import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export interface PostRow {
    id: string;
    url_path: string;
    created_at: string;
    updated_at: string;
}

export interface PostRowFilter {
    url_path?: string;
}

export interface PostRepository {
    findAll(): Promise<PostRow[]>;
    findById(id: number): Promise<PostRow | undefined>;
    insert(post: PostRow): Promise<PostRow>;
    update(id: number, image: PostRow): Promise<PostRow | null>;
    delete(id: number): Promise<boolean>;
}

export class PostDBRepository {
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
                    CREATE TABLE IF NOT EXISTS "posts" (
                        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        "url_path" TEXT NOT NULL,
                        "subject" JSONB,
                        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                `);
                console.log('[Database] posts table initialized and ready.');
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

    async findAll(filter?: PostRowFilter): Promise<PostRow[]> {
        const conditions: string[] = [];
        const params: (string | number)[] = [];

        if (filter?.url_path !== undefined && filter.url_path.trim() !== '') {
            conditions.push(`url_path = $${params.length + 1}`);
            params.push(filter.url_path.trim());
        }

        let sql = 'SELECT id, url_path, created_at, updated_at FROM posts';
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        sql += ' ORDER BY created_at DESC';

        const result = await this.pool.query<PostRow>(sql, params);
        return result.rows;
    }

    async findByIds(ids: string[]): Promise<PostRow[] | undefined> {
        const result = await this.pool.query<PostRow>(
            'SELECT id, url_path, created_at, updated_at FROM posts WHERE id = ANY($1::uuid[])',
            [ids]
        );
        const posts: PostRow[] = [];
        for (const id of ids) {
            const post = result.rows.find((post) => post.id === id);
            if (post) {
                posts.push(post);
            }
        }
        return posts;
    }

    async insert(posts: PostRow[]): Promise<PostRow[]> {
        if (!posts || posts.length === 0) return [];

        const url_paths = posts.map(i => i.url_path);
        const created_ats = posts.map(i => i.created_at || new Date().toISOString());
        const updated_ats = posts.map(i => i.updated_at || new Date().toISOString());

        const result = await this.pool.query<PostRow>(
            `INSERT INTO posts (url_path, created_at, updated_at) 
             SELECT * FROM UNNEST($1::text[], $2::timestamptz[], $3::timestamptz[])
             RETURNING id, url_path, created_at, updated_at`,
            [url_paths, created_ats, updated_ats]
        );
        return result.rows;
    }

    // async update(ids: string[], changes: Partial<{ status: string }>): Promise<ImageRow[]> {
    //     if (!ids || ids.length === 0) return [];

    //     const updates: string[] = [];
    //     const params: any[] = [];
    //     let paramIndex = 1;

    //     if (changes.status !== undefined) {
    //         updates.push(`status = $${paramIndex++}`);
    //         params.push(changes.status);
    //     }

    //     if (updates.length === 0) {
    //         return (await this.findByIds(ids)) || [];
    //     }

    //     updates.push(`updated_at = $${paramIndex++}`);
    //     params.push(new Date().toISOString());

    //     params.push(ids);

    //     const sql = `
    //         UPDATE images 
    //         SET ${updates.join(', ')} 
    //         WHERE id = ANY($${paramIndex}::uuid[]) 
    //         RETURNING id, filename, url_path, status, created_at, updated_at
    //     `;

    //     const result = await this.pool.query<ImageRow>(sql, params);
    //     return result.rows;
    // }

    async delete(id: number): Promise<boolean> {
        const result = await this.pool.query('DELETE FROM images WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
}
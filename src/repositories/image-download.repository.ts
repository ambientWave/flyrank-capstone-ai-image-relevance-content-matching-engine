import { createClient, type PhotosWithTotalResults, type ErrorResponse } from 'pexels';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pexelsClient = createClient(process.env.PEXELS_API_KEY as string);
const imageCacheDir: string = path.join(process.cwd(), 'images');

// All requests made with the client will be authenticated
async function query(query: string): Promise<PhotosWithTotalResults | ErrorResponse> {
    try {
        const result = await pexelsClient.photos.search({ query, per_page: 10 });
        return result;
    } catch (error: any) {
        // Return a proper ErrorResponse format
        return { error: error.message || 'Unknown error from Pexels API' };
    }
};

export async function store(imageMap: Map<string, string>): Promise<any> {
    for (const [name, url] of imageMap.entries()) {
        const fileName = name;
        const filePath = path.join(imageCacheDir, fileName);
        const imageContent: ArrayBuffer = await fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            return response.arrayBuffer();
        });
        // Write to disk
        await fs.writeFile(filePath, Buffer.from(imageContent));
    }
};

export {
    query,
}

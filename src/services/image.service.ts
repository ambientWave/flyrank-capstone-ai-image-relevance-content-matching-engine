import { query } from "../repositories/images.repository";

interface TaskDto {
    id: string;
    query: string;
    images: Array<{ url: string; alt: string }>;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
}

async function fetchImages(search: string): Promise<TaskDto> {
    const result = await client.photos.search({ query: search, per_page: 10 });

    return {
        id: crypto.randomUUID(),
        query: search,
        images: result.photos?.map((p: any) => ({ url: p.src.large, alt: p.alt })) ?? [],
        status: 'completed',
        createdAt: new Date(),
    };
}

async function listTasks(): Promise<TaskDto[]> {
    return [];
}

export { fetchImages, listTasks };
import { ImageEmbedRepository } from "../repositories/image-embed.repository.ts";

export class ImageEmbedService {
    private imageEmbedRepo: ImageEmbedRepository;

    constructor() {
        this.imageEmbedRepo = new ImageEmbedRepository();
    }
    // list of objects { imageUrl: string, tags: string[] }
    async embedImagesFromUrls(data: { imageUrl: string; tags: string[] }[]): Promise<void> {
        await this.imageEmbedRepo.addImageEmbeddings(data);
    }
}
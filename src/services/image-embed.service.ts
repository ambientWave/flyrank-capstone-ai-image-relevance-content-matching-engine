import { injectable } from 'tsyringe';
import { ImageEmbedRepository } from "../repositories/image-embed.repository.ts";

@injectable()
export class ImageEmbedService {
    constructor(private imageEmbedRepo: ImageEmbedRepository) {}

    async embedImagesFromUrls(data: { imageUrl: string; tags: string[] }[]): Promise<void> {
        await this.imageEmbedRepo.addImageEmbeddings(data);
    }
}
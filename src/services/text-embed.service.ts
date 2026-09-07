import { injectable } from 'tsyringe';
import { TextEmbedRepository } from "../repositories/text-embed.repository.ts";

@injectable()
export class TextEmbedService {
    constructor(private textEmbedRepo: TextEmbedRepository) {}

    async embedImageCaptions(data: { imageUrl: string; tags: string[] }[]): Promise<void> {
        await this.textEmbedRepo.addImageCaptionEmbeddings(data);
    }

    async embedPosts(postUrls: string[]): Promise<void> {
        await this.textEmbedRepo.addTextEmbeddings(postUrls);
    }
}
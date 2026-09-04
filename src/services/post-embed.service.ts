import { PostEmbedRepository } from "../repositories/post-embed.repository.ts";

export class PostEmbedService {
    private postEmbedRepo: PostEmbedRepository;

    constructor() {
        this.postEmbedRepo = new PostEmbedRepository();
    }
    // list of objects { imageUrl: string, tags: string[] }
    async embedPostFromUrl(data: string): Promise<void> {
        await this.postEmbedRepo.addTextEmbeddings(data);
    }
}
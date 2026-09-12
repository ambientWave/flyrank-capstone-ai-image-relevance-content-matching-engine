import { injectable } from 'tsyringe';
import { TextEmbedRepository, type ImageCaptionEmbeddingInput, type PostSummaryEmbeddingInput } from "../repositories/text-embed.repository.ts";
import { ImageDBRepository } from "../repositories/image-db.repository.ts";
import { PostDBRepository } from "../repositories/post-db.repository.ts";
import { CostLogDBRepository } from "../repositories/cost-log-db.repository.ts";

const NOMIC_EMBED_COST_PER_1K_TOKENS = 0.00002;

@injectable()
export class TextEmbedService {
    constructor(
        private textEmbedRepo: TextEmbedRepository,
        private imageDBRepository: ImageDBRepository,
        private postDBRepository: PostDBRepository,
        private costLogDBRepository: CostLogDBRepository
    ) { }

    async embedImageCaption(imageId: string): Promise<void> {
        const image = await this.imageDBRepository.findById(imageId);
        if (!image) {
            console.log(`Image ${imageId} not found`);
            return;
        }

        if (image.status === 'embedded') {
            console.log(`Image ${imageId} already embedded, skipping`);
            return;
        }

        const tag = image.tag as any;
        const caption = tag?.caption;
        const subject = tag?.subject;
        const category = tag?.category;
        const attributes = tag?.attributes || [];
        const confidence = tag?.confidence || 0;

        if (!caption) {
            console.log(`No caption found for image ${imageId}`);
            return;
        }

        await this.imageDBRepository.update([imageId], { status: 'embedding' });

        const text = caption;
        const tokens = Math.ceil(text.length / 4);

        await this.textEmbedRepo.addImageCaptionEmbeddings([{
            imageId,
            imageUrl: image.url_path,
            caption,
            subject,
            category,
            attributes,
            confidence,
        }]);

        await this.costLogDBRepository.insert({
            call_type: 'embedding',
            ref_id: imageId,
            tokens_or_units: tokens,
            cost_usd: (tokens / 1000) * NOMIC_EMBED_COST_PER_1K_TOKENS,
        });

        await this.imageDBRepository.update([imageId], { status: 'embedded' });
    }

    async embedPostSummary(postId: string): Promise<void> {
        const post = await this.postDBRepository.findById(postId);
        console.log("post", post);
        if (!post) {
            console.log(`Post ${postId} not found`);
            return;
        }

        if (post.status === 'embedded') {
            console.log(`Post ${postId} already embedded, skipping`);
            return;
        }

        if (!post.summary) {
            console.log(`No summary found for post ${postId}`);
            return;
        }

        await this.postDBRepository.update([postId], { status: 'embedding' });

        const text = post.summary;
        const tokens = Math.ceil(text.length / 4);

        await this.textEmbedRepo.addPostSummaryEmbeddings([{
            postId,
            postUrl: post.url_path,
            summary: text,
        }]);

        await this.costLogDBRepository.insert({
            call_type: 'embedding',
            ref_id: postId,
            tokens_or_units: tokens,
            cost_usd: (tokens / 1000) * NOMIC_EMBED_COST_PER_1K_TOKENS,
        });

        await this.postDBRepository.update([postId], { status: 'embedded' });
    }

    async embedImageCaptions(data: ImageCaptionEmbeddingInput[]): Promise<void> {
        for (const item of data) {
            const tokens = Math.ceil(item.caption.length / 4);

            await this.textEmbedRepo.addImageCaptionEmbeddings([item]);

            await this.costLogDBRepository.insert({
                call_type: 'embedding',
                ref_id: item.imageId,
                tokens_or_units: tokens,
                cost_usd: (tokens / 1000) * NOMIC_EMBED_COST_PER_1K_TOKENS,
            });
        }
    }

    async embedPostSummaries(data: PostSummaryEmbeddingInput[]): Promise<void> {
        for (const item of data) {
            const text = item.summary;
            const tokens = Math.ceil(text.length / 4);

            await this.textEmbedRepo.addPostSummaryEmbeddings([item]);

            await this.costLogDBRepository.insert({
                call_type: 'embedding',
                ref_id: item.postId,
                tokens_or_units: tokens,
                cost_usd: (tokens / 1000) * NOMIC_EMBED_COST_PER_1K_TOKENS,
            });
        }
    }
}
import { injectable } from 'tsyringe';
import { ImageDBRepository } from '../repositories/image-db.repository.ts';
import { PostDBRepository } from '../repositories/post-db.repository.ts';
import { ImageEmbedService } from './image-embed.service.ts';
import { TextEmbedService } from './text-embed.service.ts';
import { PostEmbedService } from './post-embed.service.ts';
import { JobQueueService } from './job-queue.service.ts';
import { ImageUnderstandService, type ValidatedImageData } from './image-understand.service.ts';
import { PostDownloadService } from './post-download.service.ts';
import { PostSummarizeService } from './post-summarize.service.ts';

@injectable()
export class IngestionOrchestratorService {
    constructor(
        private imageDBRepository: ImageDBRepository,
        private postDBRepository: PostDBRepository,
        private imageEmbedService: ImageEmbedService,
        private textEmbedService: TextEmbedService,
        private postEmbedService: PostEmbedService,
        private jobQueueService: JobQueueService,
        private imageUnderstandService: ImageUnderstandService,
        private postDownloadService: PostDownloadService,
        private postSummarizeService: PostSummarizeService
    ) { }

    async enqueueIngestionPipeline(urls: string[]): Promise<{ batchId: string; count: number }> {
        const images = await this.imageDBRepository.insert(urls.map(url => ({
            filename: url.substring(url.lastIndexOf('/') + 1),
            url_path: url,
            status: 'pending'
        })));
        const imageIds = images.map(img => img.id);

        await this.jobQueueService.addVisionJobs(imageIds);

        return { batchId: crypto.randomUUID(), count: images.length };
    }

    async onImageUnderstandComplete(validatedImageData: ValidatedImageData[]) {
        const imageIds = validatedImageData.map(d => d.id);

        await this.imageEmbedService.embedImagesFromUrls(validatedImageData.map(d => ({ imageUrl: d.imageUrl, tags: d.tags })));

        await this.jobQueueService.addEmbedJobs(imageIds, 'image');
    }

    async enqueuePostPipeline(postUrls: string[]): Promise<{ batchId: string; count: number }> {
        const postsText = await this.postDownloadService.fetchPostsText(postUrls);

        const posts = await this.postDBRepository.insert(postsText.map(p => ({
            filename: p.url.substring(p.url.lastIndexOf('/') + 1),
            url_path: p.url,
            status: 'pending'
        })));
        const postIds = posts.map(p => p.id);

        await this.jobQueueService.addPostSummarizeJobs(postIds);

        return { batchId: crypto.randomUUID(), count: posts.length };
    }

    async onPostSummarizeComplete(postId: string, summary: string): Promise<void> {
        const post = await this.postDBRepository.findById(postId);
        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

        // Title is extracted from the post content during download
        await this.postSummarizeService.saveSummary(postId, summary);
        await this.jobQueueService.addEmbedJobs([postId], 'post');
    }

    async onPostEmbedComplete(postId: string): Promise<void> {
        await this.postDBRepository.update([postId], { status: 'embedded' });
    }
}
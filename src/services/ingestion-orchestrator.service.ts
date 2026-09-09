import { injectable } from 'tsyringe';
import { ImageDBRepository } from '../repositories/image-db.repository.ts';
import { ImageEmbedService } from './image-embed.service.ts';
import { TextEmbedService } from './text-embed.service.ts';
import { JobQueueService } from './job-queue.service.ts';
import { ImageUnderstandService } from './image-understand.service.ts';

@injectable()
export class IngestionOrchestratorService {
    constructor(
        private imageDBRepository: ImageDBRepository,
        private imageEmbedService: ImageEmbedService,
        private textEmbedService: TextEmbedService,
        private jobQueueService: JobQueueService,
        private imageUnderstandService: ImageUnderstandService
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

    async onImageUnderstandComplete(validatedImageData: { id: string, imageUrl: string, caption: string, tags: string[] }[]) {
        await this.imageEmbedService.embedImagesFromUrls(validatedImageData.map(d => ({ imageUrl: d.imageUrl, tags: d.tags })));

        await this.textEmbedService.embedImageCaptions(validatedImageData.map(d => ({ imageUrl: d.imageUrl, tags: d.tags })));
        await this.imageDBRepository.update(
            validatedImageData.map(d => d.id),
            'embedded'
        );

    }


    async enqueuePostPipeline(posts: { title: string, body: string }[]): Promise<{ count: number }> {
        const rows = await this.postDBRepository.insert(posts.map(p => ({ ...p, status: 'pending' })));
        await this.jobQueueService.addPostUnderstandJobs(rows.map(p => p.id));
        return { count: rows.length };
    }

    async onPostSummarizeComplete(postId: string, subject: { subject: string, category: string }) {
        await this.postDBRepository.saveSubject(postId, subject);
        await this.textEmbedService.embedPost(postId);
        await this.postDBRepository.update(postId, 'embedded');

        // await this.onPostReady(postId);   // chains straight in, one owner of the sequencing
    }

    // async onPostReady(postId: string) {
    //     await this.guardService.evaluateMatch(postId);
    // }
}
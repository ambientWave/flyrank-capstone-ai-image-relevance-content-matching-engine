import { injectable } from 'tsyringe';
import { TextSummarizeRepository } from '../repositories/post-summarize.repository.ts';
import { PostDBRepository } from '../repositories/post-db.repository.ts';
import { PostDownloadService } from './post-download.service.ts';
import { CostLogDBRepository } from '../repositories/cost-log-db.repository.ts';

export interface SummarizeResult {
    summary: string;
    inputTokens: number;
    outputTokens: number;
}

// Local model (t5-small) - no API cost, but track tokens for observability
const SUMMARIZATION_COST_PER_1K_TOKENS = 0;

@injectable()
export class PostSummarizeService {
    constructor(
        private textSummarizeRepo: TextSummarizeRepository,
        private postDBRepository: PostDBRepository,
        private postDownloadService: PostDownloadService,
        private costLogDBRepository: CostLogDBRepository
    ) { }

    async summarize(text: string): Promise<SummarizeResult> {
        const result = await this.textSummarizeRepo.summarizePost(text);
        return result;
    }

    async summarizePost(postId: string): Promise<string> {
        const post = await this.postDBRepository.findById(postId);
        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

        if (post.status === 'summarized' || post.status === 'embedded') {
            console.log(`Post ${postId} already ${post.status}, skipping`);
            return post.summary || '';
        }

        await this.postDBRepository.update([postId], { status: 'summarizing' });

        const postContent = await this.postDownloadService.fetchPostsText([post.url_path]);
        if (!postContent || postContent.length === 0 || !postContent[0]?.content) {
            await this.postDBRepository.update([postId], { status: 'failed' });
            throw new Error(`Failed to fetch post content`);
        }

        const content = postContent[0].content!;
        const body = content.split('\n').slice(1).join('\n') || content;
        
        const { summary, inputTokens, outputTokens } = await this.summarize(body);
        const totalTokens = inputTokens + outputTokens;
        
        await this.logCost(postId, totalTokens);

        await this.saveSummary(postId, summary);

        return summary;
    }

    async saveSummary(postId: string, summary: string): Promise<void> {
        await this.postDBRepository.saveSummary(postId, summary);
    }

    async logCost(refId: string, totalTokens: number): Promise<void> {
        const costUsd = (totalTokens / 1000) * SUMMARIZATION_COST_PER_1K_TOKENS;
        await this.costLogDBRepository.insert({
            call_type: 'summarization',
            ref_id: refId,
            tokens_or_units: totalTokens,
            cost_usd: costUsd,
        });
    }
}
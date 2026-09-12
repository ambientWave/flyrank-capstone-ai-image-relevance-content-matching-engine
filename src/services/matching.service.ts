import { injectable } from 'tsyringe';
import { TextEmbedRepository } from '../repositories/text-embed.repository.ts';

export interface SimilarityResult {
    imageId: string;
    imageUrl: string;
    caption: string;
    similarity: number;
    subject?: string;
    category?: string;
    attributes?: string;
    confidence?: number;
}

interface ChromaMetadata {
    imageUrl?: string;
    subject?: string;
    category?: string;
    attributes?: string;
    confidence?: number;
}

@injectable()
export class MatchingService {
    constructor(
        private textEmbedRepo: TextEmbedRepository
    ) { }

    async getPostEmbedding(postId: string, summary: string): Promise<number[]> {
        return await this.textEmbedRepo.generateTextEmbedding(summary);
    }

    async findSimilarImages(postEmbedding: number[], nResults: number = 10): Promise<SimilarityResult[]> {
        const results = await this.textEmbedRepo.querySimilarImageCaptions(postEmbedding, nResults);

        const candidates: SimilarityResult[] = [];
        if (results.ids && results.ids[0]) {
            for (let i = 0; i < results.ids[0].length; i++) {
                const imageId = results.ids[0][i];
                const distance = results.distances?.[0]?.[i] ?? 1;
                const metadata = results.metadatas?.[0]?.[i] as ChromaMetadata | null | undefined;

                const meta = (metadata || {}) as ChromaMetadata;

                candidates.push({
                    imageId: imageId as string,
                    imageUrl: (meta.imageUrl ?? imageId) as string,
                    caption: (meta.subject ?? meta.attributes ?? '') as string,
                    similarity: 1 - distance,
                    subject: (meta.subject ?? '') as string,
                    category: (meta.category ?? '') as string,
                    attributes: (meta.attributes ?? '') as string,
                    confidence: (meta.confidence ?? 0) as number,
                });
            }
        }

        return candidates.sort((a, b) => b.similarity - a.similarity);
    }
}
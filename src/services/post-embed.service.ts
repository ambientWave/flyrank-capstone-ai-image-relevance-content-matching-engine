import { injectable } from 'tsyringe';
import { TextEmbedRepository } from '../repositories/text-embed.repository.ts';

export interface EmbedResult {
    embedding: number[];
    tokens: number;
}

@injectable()
export class PostEmbedService {
    constructor(private textEmbedRepo: TextEmbedRepository) {}

    async embedPost(summary: string): Promise<EmbedResult> {
        const tokenizer = await this.textEmbedRepo['tokenizer'];
        const model = await this.textEmbedRepo['textEmbeddingModel'];
        
        const inputs = await tokenizer(summary, { padding: true, truncation: true, return_tensors: 'pt' });
        const tokens = (inputs.input_ids as any).shape[1];
        
        const { text_embeds } = await model(inputs);
        const embedding = Array.from(text_embeds.data as Float32Array);
        
        return { embedding, tokens };
    }
}
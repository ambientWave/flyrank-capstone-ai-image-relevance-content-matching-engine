import { injectable } from 'tsyringe';
import {
    AutoTokenizer,
    AutoModel,
    type PreTrainedTokenizer,
    type PreTrainedModel,
} from '@huggingface/transformers';
import { ChromaClient, type Collection } from "chromadb";
import { chromadbConfig } from '../config/chromadb.ts';


const MODEL_ID = 'nomic-ai/nomic-embed-text-v1.5';

export interface TextEmbedding {
    resourceUrl: string;
    embedding: number[];
    tags: string[];
}

@injectable()
export class TextEmbedRepository {
    private client: ChromaClient;
    private readonly textEmbeddingModel: Promise<PreTrainedModel>;
    private readonly tokenizer: Promise<PreTrainedTokenizer>;
    private readonly textCollection: Promise<Collection>;

    constructor() {
        this.client = new ChromaClient(chromadbConfig);
        this.textEmbeddingModel = AutoModel.from_pretrained(MODEL_ID, { dtype: "fp16" });
        this.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID);
        this.textCollection = this.client.getOrCreateCollection({
            name: "text_embeddings",
        });
    }

    async generateTextEmbedding(text: string): Promise<number[]> {
        const tokenizer = await this.tokenizer;
        const textEmbeddingModel = await this.textEmbeddingModel;
        const inputs = await tokenizer(text, { padding: true, truncation: true, return_tensors: 'pt' });
        const { text_embeds } = await textEmbeddingModel(inputs);
        return Array.from(text_embeds.data as Float32Array);
    }

    async addImageCaptionEmbeddings(data: { imageUrl: string; tags: string[] }[]): Promise<void> {
        if (!data || data.length === 0) return;

        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: { tags: string }[] = [];

        for (const item of data) {
            const text = item.tags.join(', ');
            const embedding = await this.generateTextEmbedding(text);
            ids.push(item.imageUrl);
            embeddings.push(embedding);
            metadatas.push({ tags: item.tags.join(',') });
        }

        const collection = await this.textCollection;
        await collection.add({ ids, embeddings, metadatas });
    }

    async addTextEmbeddings(postUrls: string[]): Promise<void> {
        if (!postUrls || postUrls.length === 0) return;

        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: { content: string }[] = [];

        for (const url of postUrls) {
            const embedding = await this.generateTextEmbedding(url);
            ids.push(url);
            embeddings.push(embedding);
            metadatas.push({ content: url });
        }

        const collection = await this.textCollection;
        await collection.add({ ids, embeddings, metadatas });
    }

    async querySimilarTexts(embedding: number[], nResults: number = 10) {
        const collection = await this.textCollection;
        return collection.query({
            queryEmbeddings: [embedding],
            nResults,
        });
    }
}

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

export interface ImageCaptionEmbeddingInput {
    imageId: string;
    imageUrl: string;
    caption: string;
    subject: string;
    category: string;
    attributes: string[];
    confidence: number;
}

export interface PostSummaryEmbeddingInput {
    postId: string;
    postUrl: string;
    summary: string;
}

@injectable()
export class TextEmbedRepository {
    private client: ChromaClient;
    private readonly textEmbeddingModel: Promise<PreTrainedModel>;
    private readonly tokenizer: Promise<PreTrainedTokenizer>;
    private readonly imageCaptionCollection: Promise<Collection>;
    private readonly postSummaryCollection: Promise<Collection>;

    constructor() {
        this.client = new ChromaClient(chromadbConfig);
        this.textEmbeddingModel = AutoModel.from_pretrained(MODEL_ID, { dtype: "fp16" });
        this.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID);
        this.imageCaptionCollection = this.client.getOrCreateCollection({
            name: "image_caption_embedding",
        });
        this.postSummaryCollection = this.client.getOrCreateCollection({
            name: "post_summary_embedding",
        });
    }

    private normalizeEmbedding(embedding: number[]): number[] {
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0) return embedding;
        return embedding.map(val => val / norm);
    }

    async generateTextEmbedding(text: string): Promise<number[]> {
        const tokenizer = await this.tokenizer;
        const textEmbeddingModel = await this.textEmbeddingModel;
        const inputs = await tokenizer(text, { padding: true, truncation: true, return_tensors: 'pt' });
        const output = await textEmbeddingModel(inputs);
        const lastHiddenState = output.last_hidden_state || output.text_embeds;
        if (!lastHiddenState) {
            throw new Error('No embeddings found in model output');
        }
        const embeddings = lastHiddenState.mean(1);
        const rawEmbedding = Array.from(embeddings.data as Float32Array);
        return this.normalizeEmbedding(rawEmbedding);
    }

    async addImageCaptionEmbeddings(data: ImageCaptionEmbeddingInput[]): Promise<void> {
        if (!data || data.length === 0) return;

        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: { 
            imageUrl: string;
            subject: string; 
            category: string; 
            attributes: string; 
            confidence: number;
        }[] = [];

        for (const item of data) {
            const embedding = await this.generateTextEmbedding(item.caption);
            ids.push(item.imageId);
            embeddings.push(embedding);
            metadatas.push({ 
                imageUrl: item.imageUrl,
                subject: item.subject,
                category: item.category,
                attributes: item.attributes.join(','),
                confidence: item.confidence,
            });
        }

        const collection = await this.imageCaptionCollection;
        await collection.add({ ids, embeddings, metadatas });
    }

    async addPostSummaryEmbeddings(data: PostSummaryEmbeddingInput[]): Promise<void> {
        if (!data || data.length === 0) return;

        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: { postUrl: string }[] = [];

        for (const item of data) {
            const embedding = await this.generateTextEmbedding(item.summary);
            ids.push(item.postId);
            embeddings.push(embedding);
            metadatas.push({ postUrl: item.postUrl });
        }

        const collection = await this.postSummaryCollection;
        await collection.add({ ids, embeddings, metadatas });
    }

    async querySimilarImageCaptions(embedding: number[], nResults: number = 10) {
        const collection = await this.imageCaptionCollection;
        return collection.query({
            queryEmbeddings: [embedding],
            nResults,
        });
    }

    async querySimilarPostSummaries(embedding: number[], nResults: number = 10) {
        const collection = await this.postSummaryCollection;
        return collection.query({
            queryEmbeddings: [embedding],
            nResults,
        });
    }
}

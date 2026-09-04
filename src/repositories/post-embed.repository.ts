import {
    AutoTokenizer,
    CLIPTextModelWithProjection,
    type PreTrainedTokenizer,
    type PreTrainedModel,
} from '@huggingface/transformers';
import { ChromaClient, type Collection } from "chromadb";


const MODEL_ID = 'Xenova/clip-vit-base-patch32';

export interface ImageEmbedding {
    postUrl: string;
    embedding: number[];
    tags: string[];
}

export class PostEmbedRepository {
    private client: ChromaClient;
    // private readonly textEmbeddingPipeline: Promise<any>;
    private readonly textEmbeddingModel: Promise<PreTrainedModel>;
    private readonly tokenizer: Promise<PreTrainedTokenizer>;
    private readonly postCollection: Promise<Collection>;

    constructor() {
        this.client = new ChromaClient({
            host: process.env.CHROMADB_HOST || "chromadb",
            port: 8000
        });
        this.textEmbeddingModel = CLIPTextModelWithProjection.from_pretrained(MODEL_ID);
        this.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID);
        this.postCollection = this.client.getOrCreateCollection({
            name: "post_embeddings",
        });
        // this.postCollection = this.client.getOrCreateCollection({
        //     name: "post_embeddings",
        // });
    }

    async loadTextFromUrl(url: string): Promise<string> {
        const response = await fetch(url);
        return await response.text();
    }

    async generateTextEmbedding(postUrl: string): Promise<number[]> {
        const text = await this.loadTextFromUrl(postUrl);
        // 3. Perform inference
        const tokenizer = await this.tokenizer;
        const textEmbeddingModel = await this.textEmbeddingModel;
        const inputs = await tokenizer(text, { padding: true, truncation: true, return_tensors: 'pt' });
        const { image_embeds } = await textEmbeddingModel(inputs);
        return Array.from(image_embeds.data as Float32Array);
    }

    async addTextEmbeddings(postUrls: string[], tags: string[]): Promise<void> {
        const embeddings: number[][] = [];
        for (const url of postUrls) {
            const embedding = await this.generateTextEmbedding(url);
            embeddings.push(embedding);
        }

        const collection = await this.postCollection;
        await collection.add({
            ids: postUrls,
            embeddings,
            metadatas: postUrls.map(() => ({ tags: tags.join(",") })),
        });
    }

    async querySimilarTexts(embedding: number[], nResults: number = 10) {
        const collection = await this.postCollection;
        return collection.query({
            queryEmbeddings: [embedding],
            nResults,
        });
    }
}

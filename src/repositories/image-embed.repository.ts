import {
    AutoProcessor,
    CLIPVisionModelWithProjection,
    RawImage,
    env,
    type Processor,
    type PreTrainedModel,
} from '@huggingface/transformers';
import { ChromaClient, type Collection } from "chromadb";


const MODEL_ID = 'Xenova/clip-vit-base-patch32';

export interface ImageEmbedding {
    imageUrl: string;
    embedding: number[];
    tags: string[];
}

export class ImageEmbedRepository {
    private client: ChromaClient;
    private readonly imageEmbeddingModel: Promise<PreTrainedModel>;
    private readonly processor: Promise<Processor>;
    // private readonly textEmbeddingPipeline: Promise<any>;
    private readonly imageCollection: Promise<Collection>;
    // private readonly postCollection: Promise<Collection>;

    constructor() {
        this.client = new ChromaClient({
            host: process.env.CHROMADB_HOST || "chromadb",
            port: 8000
        });
        this.imageEmbeddingModel = CLIPVisionModelWithProjection.from_pretrained(MODEL_ID);
        this.processor = AutoProcessor.from_pretrained(MODEL_ID);
        this.imageCollection = this.client.getOrCreateCollection({
            name: "image_embeddings",
        });
        // this.postCollection = this.client.getOrCreateCollection({
        //     name: "post_embeddings",
        // });
    }

    async loadImageFromUrl(url: string): Promise<RawImage> {
        const response = await RawImage.read(url);
        return response;
    }

    async generateImageEmbedding(imageUrl: string): Promise<number[]> {
        // 3. Perform inference
        const image = await this.loadImageFromUrl(imageUrl);
        const processor = await this.processor;
        const visionModel = await this.imageEmbeddingModel;
        const inputs = await processor(image);
        const { image_embeds } = await visionModel(inputs);
        return Array.from(image_embeds.data as Float32Array);
    }

    async addImageEmbeddings(items: { imageUrl: string; tags: string[] }[]): Promise<void> {
        if (!items || items.length === 0) return;

        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: { tags: string }[] = [];

        for (const item of items) {
            // item.imageUrl is a string passed to generateImageEmbedding(imageUrl: string)
            const embedding = await this.generateImageEmbedding(item.imageUrl);
            ids.push(item.imageUrl);
            embeddings.push(embedding);
            metadatas.push({ tags: item.tags.join(",") });
        }

        const collection = await this.imageCollection;
        const count = await collection.count();
        console.log("collection count", count);
        console.log({
            ids,
            embeddings,
            metadatas,
        })
        await collection.add({
            ids,
            embeddings,
            metadatas,
        });
    }

    async querySimilarImages(embedding: number[], nResults: number = 10) {
        const collection = await this.imageCollection;
        return collection.query({
            queryEmbeddings: [embedding],
            nResults,
        });
    }
}

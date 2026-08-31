import { analyzeImage } from "../repositories/image-understand.repository.ts";
import { z } from "zod";

export const VisionTagSchema = z.object({
    subject: z.string().min(1),
    category: z.string().min(1),
    attributes: z.array(z.string()).default([]),
    caption: z.string().min(1),
    confidence: z.number().min(0).max(1),
});

// for each image in images folder, read the image and understand it using understand function then validate against schema
async function understandImage(imageUrls: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const imageUrl of imageUrls) {
        const imageData = await fetch(imageUrl).then((response) => {
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            return response.arrayBuffer();
        });
        const result = await analyzeImage(imageUrl, Buffer.from(imageData));
        console.log("understand result", result);
        results.push(result);
    }
    return results;
}

async function validateSchema(): Promise<any[]> {

    return [];
}

export { understandImage, validateSchema };
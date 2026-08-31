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
/**
 * This fucntion return list of objects like
    {
      subject: 'red foxes',
      category: 'animal',
      attributes: [ 'red fur', 'wild', 'grazing', 'outdoor', 'grassland' ], // this is what we store as tags in vector database
      caption: 'Two red foxes walking and foraging in a lush green grassy field during the day.',
      confidence: 0.98
    } */
async function understandImage(imageUrls: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const imageUrl of imageUrls) {
        let imageData: ArrayBuffer;
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                continue;
            }
            imageData = await response.arrayBuffer();
        } catch (error) {
            continue;
        }
        const aiResponse = await analyzeImage(imageUrl, Buffer.from(imageData));
        console.log("understand result", aiResponse);
        results.push({ imageUrl, response: aiResponse });
    }
    return results;
}

async function validateSchema(imageUrl: string, aiResponse: {
    subject: string,
    category: string,
    attributes: string[],
    caption: string,
    confidence: number,
}): Promise<{
    imageUrl: string, data: {
        tags: string[],
    }, error?: string
}> {
    try {
        const validatedData = VisionTagSchema.parse(aiResponse);
        if (validatedData.confidence < 0.8) {
            return { imageUrl: imageUrl, data: { tags: validatedData.attributes }, error: 'Confidence is low' };
        }
        return { imageUrl: imageUrl, data: { tags: validatedData.attributes } };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { imageUrl: imageUrl, data: { tags: aiResponse.attributes }, error: "Invalid Schema" };
        }
        throw error;
    }
}

export { understandImage, validateSchema };
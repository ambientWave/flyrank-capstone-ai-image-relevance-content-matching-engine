import { GoogleGenAI, type File } from "@google/genai";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();


// Define the response schema
interface ImageAnalysis {
    subject: string;
    category: string;
    attributes: string[];
    caption: string;
    confidence: number;
}

interface BatchProcessingResult {
    imagePath: string;
    analysis: ImageAnalysis | null;
    error: string | null;
}
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
const batchSize = 10;

/**
 * Converts image file to base64 encoded string
 */
async function imageToBase64(image: Buffer<ArrayBuffer>): Promise<string> {
    // const imageBuffer = await fs.promises.readFile(imagePath);
    // convert image Buffer<ArrayBuffer> to base64 string
    const base64Image = Buffer.from(image).toString('base64');
    return base64Image;
}

/**
 * Determines MIME type from file extension
 */
function getMimeType(url: string): string {
    // this is now a url
    const extension: string | undefined = url.split('.').pop()?.toLowerCase();
    if (!extension) {
        throw new Error('Failed to get extension from url');
    }
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
    };
    return mimeTypes[extension] || 'image/jpeg';
}

/**
 * Analyzes a single image using Gemini Vision
 */
export async function analyzeImage(imagePath: string, image: Buffer<ArrayBuffer>): Promise<ImageAnalysis | null> {
    try {
        const base64Image = await imageToBase64(image);
        const mimeType = getMimeType(imagePath);

        const systemPrompt = `You are an expert image analyst. Analyze the image and respond ONLY with valid JSON in this exact format:
                            {
                                "subject": "main subject of the image",
                                "category": "category like: animal, person, object, landscape, etc",
                                "attributes": ["attribute1", "attribute2", "attribute3"],
                                "caption": "brief descriptive caption (10-20 words)",
                                "confidence": 0.0-1.0 confidence score
                            }

                            Be precise and concise. Always respond with valid JSON only.`;

        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [
                {
                    role: "system",
                    parts: [{ text: systemPrompt }],
                },
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Image,
                            },
                        },
                        {
                            text: 'Analyze this image and provide structured data as JSON.',
                        },
                    ],
                },
            ],
            config: {
                responseMimeType: 'application/json',
                maxOutputTokens: 500,
                temperature: 0.2,
            },
        });

        const textContent = response.candidates?.[0]?.content?.parts?.[0];
        if (!textContent?.text) {
            throw new Error('No text response from model');
        }

        // Parse JSON response
        const analysis = JSON.parse(textContent.text) as ImageAnalysis;
        return analysis;
    } catch (error) {
        console.error(`Error analyzing ${imagePath}:`, error);
        return null;
    }
}

/**
 * Processes a batch of images concurrently
 */
// async function processBatch(
//     imagePaths: string[],
// ): Promise<BatchProcessingResult[]> {
//     const results: BatchProcessingResult[] = [];

//     const promises = imagePaths.map(async (imagePath) => {
//         const analysis = await analyzeImage(imagePath);
//         return {
//             imagePath,
//             analysis,
//             error: analysis ? null : `Failed to analyze ${imagePath}`,
//         };
//     });

//     const batchResults = await Promise.all(promises);
//     results.push(...batchResults);

//     return results;
// }

/**
 * Main method: Process all images in batches
 */
// async function processBatchImages(
//     imagePaths: string[],
// ): Promise<BatchProcessingResult[]> {
//     const allResults: BatchProcessingResult[] = [];

//     console.log(`Starting batch processing of ${imagePaths.length} images...`);
//     console.log(`Batch size: ${batchSize}`);

//     for (let i = 0; i < imagePaths.length; i += batchSize) {
//         const batch = imagePaths.slice(i, i + batchSize);
//         const batchNumber = Math.floor(i / batchSize) + 1;
//         const totalBatches = Math.ceil(imagePaths.length / batchSize);

//         console.log(
//             `\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} images)...`,
//         );

//         const batchResults = await processBatch(batch);
//         allResults.push(...batchResults);

//         // Add delay between batches to avoid rate limiting
//         if (i + batchSize < imagePaths.length) {
//             await new Promise((resolve) => setTimeout(resolve, 1000));
//         }
//     }

//     console.log(`\nBatch processing completed!`);
//     return allResults;
// }

/**
 * Save results to JSON file
 */
async function saveResults(
    results: BatchProcessingResult[],
    outputPath: string,
): Promise<void> {
    const formattedResults = results.map((result) => ({
        imagePath: result.imagePath,
        analysis: result.analysis,
        error: result.error,
    }));

    await fs.promises.writeFile(
        outputPath,
        JSON.stringify(formattedResults, null, 2),
    );
    console.log(`Results saved to ${outputPath}`);
}


// Example usage
// async function main() {
//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) {
//         throw new Error('GEMINI_API_KEY environment variable not set');
//     }

//     // Initialize analyzer with batch size of 3
//     const analyzer = new BatchImageAnalyzer(apiKey, 3);

//     // Get image files from a directory
//     const imageDir = './images'; // Adjust path as needed
//     const imagePaths = (await fs.promises.readdir(imageDir))
//         .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
//         .map((file) => path.join(imageDir, file));

//     if (imagePaths.length === 0) {
//         console.log('No images found in the directory');
//         return;
//     }

//     console.log(`Found ${imagePaths.length} images to process`);

//     // Process all images in batches
//     const results = await analyzer.processBatchImages(imagePaths);

//     // Save results to file
//     await analyzer.saveResults(results, './analysis_results.json');

//     // Print summary
//     const successful = results.filter((r) => r.analysis !== null).length;
//     console.log(
//         `\nSummary: ${successful}/${results.length} images successfully analyzed`,
//     );

//     // Print first result as example
//     if (results[0]?.analysis) {
//         console.log('\nExample result:');
//         console.log(JSON.stringify(results[0].analysis, null, 2));
//     }
// }
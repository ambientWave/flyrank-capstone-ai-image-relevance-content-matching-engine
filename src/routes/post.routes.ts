import { Router, type Request, type Response, type NextFunction } from 'express';

const router: Router = Router();

router.post('/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { post_urls } = req.body ?? [];
        console.log("post_urls", post_urls);
        if (!post_urls || !Array.isArray(post_urls)) {
            return res.status(400).json({ error: 'post_urls is required' });
        }
        const aiResponses = await understandImage(image_urls); // return list of objects
        const validatedSchemas: [{}] = [{}];
        const validatedImageData: { imageUrl: string, tags: string[] }[] = [];
        for (const aiResponse of aiResponses) {
            const validatedSchema = await validateSchema(aiResponse.imageUrl, aiResponse.response);
            if (validatedSchema?.error === "Confidence is low") {
                console.log("Confidence is low", validatedSchema);
                continue;
            } else if (validatedSchema?.error === "Invalid Schema") {
                console.log("Invalid Schema", validatedSchema);
                continue;
            } else {
                validatedImageData.push({ imageUrl: validatedSchema.imageUrl, tags: validatedSchema.data.tags });
            }
        }
        const imageEmbedService = req.app.get('imageEmbedService');
        await imageEmbedService.embedImagesFromUrls(validatedImageData);

        res.status(201).json({ validatedImageData, validatedSchemas });
    });

export default router;
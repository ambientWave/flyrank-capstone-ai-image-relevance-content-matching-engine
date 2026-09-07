import { Router, type Request, type Response, type NextFunction } from 'express';

const router: Router = Router();

router.post('/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { post_urls } = req.body ?? [];
        console.log("post_urls", post_urls);
        if (!post_urls || !Array.isArray(post_urls)) {
            return res.status(400).json({ error: 'post_urls is required' });
        }
        res.status(201).json({});
    } catch (error) {
        next(error);
    }
});

export default router;
import { Router, type Request, type Response, type NextFunction } from 'express';

const router: Router = Router();

router.post('/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { content } = req.body ?? {};
        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'post content is required' });
        }
        // const task = await fetchImages(content);
        // res.status(201).json(task);
    } catch (err) {
        next(err);
    }
});

export default router;
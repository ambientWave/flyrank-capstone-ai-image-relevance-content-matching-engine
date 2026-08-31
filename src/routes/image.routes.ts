import { Router, type Request, type Response, type NextFunction } from 'express';
import { downloadImagesList } from '../services/image-download.service.js';
import { understandImage } from '../services/image-understand.service.js';

const router: Router = Router();
// red fox, wolf, dog, bear, deer
router.get('/download/images', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search } = req.query ?? {};
        if (!search || typeof search !== 'string') {
            return res.status(400).json({ error: 'search is required' });
        }
        res.json(await downloadImagesList(search));
    } catch (err) {
        next(err);
    }
});

router.post('/images', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { image_urls } = req.body ?? [];
        console.log("image_urls", image_urls);
        if (!image_urls || !Array.isArray(image_urls)) {
            return res.status(400).json({ error: 'image_urls is required' });
        }
        const aiResponse = await understandImage(image_urls);
        res.status(201).json({ aiResponse });
    } catch (err) {
        next(err);
    }
});

export default router;
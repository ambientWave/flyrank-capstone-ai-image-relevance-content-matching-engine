import { Router, type Request, type Response, type NextFunction } from 'express';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import { downloadImagesList } from '../services/image-download.service.js';
import { JobQueueService } from '../services/job-queue.service.ts';
import { container } from '../config/container.ts';

const router: Router = Router();
const orchestrator = container.resolve('IngestionOrchestratorService') as IngestionOrchestratorService;
const jobQueueService = container.resolve('JobQueueService') as JobQueueService;

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
/**
 * The rule that resolves this: each layer's job is who's allowed to make decisions.
 * - Routes translate HTTP → a single service call, nothing more — they shouldn't know there's
 *  a list at all, just that a request came in and a response goes out.
 * - Repositories translate one bulk operation → SQL — they can express "insert these N rows" 
 *  as a single query, but they shouldn't contain a for loop calling insert() N times, 
 *  because that's business orchestration wearing a persistence hat.
 * - The service layer is the only place that's actually allowed to say "for each of these, 
 *  do a thing" — that decision is the business logic.
 */
router.post('/images', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { image_urls } = req.body ?? [];
        console.log("image_urls", image_urls);
        if (!image_urls || !Array.isArray(image_urls)) {
            return res.status(400).json({ error: 'image_urls is required' });
        }
        const result = await orchestrator.enqueueIngestionPipeline(image_urls);
        res.status(202).json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/jobs/:queue/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { queue, id } = req.params as { queue: 'vision' | 'embed'; id: string };
        if (!queue || !id) {
            return res.status(400).json({ error: 'queue and id are required' });
        }
        if (queue !== 'vision' && queue !== 'embed') {
            return res.status(400).json({ error: 'queue must be vision or embed' });
        }
        const status = await jobQueueService.getJobStatus(queue, id);
        res.json({ jobId: id, queue, status });
    } catch (err) {
        next(err);
    }
});

export default router;

/**import { Router, type Request, type Response, type NextFunction } from 'express';
import { enqueueImageBatch } from '../services/ingestion-orchestrator.service.js';
import { downloadImagesList } from '../services/image-download.service.js';
import { getJobStatus } from '../services/job-queue.service.js';

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

 * The rule that resolves this: each layer's job is who's allowed to make decisions.
 * - Routes translate HTTP → a single service call, nothing more — they shouldn't know there's
 *  a list at all, just that a request came in and a response goes out.
 * - Repositories translate one bulk operation → SQL — they can express "insert these N rows" 
 *  as a single query, but they shouldn't contain a for loop calling insert() N times, 
 *  because that's business orchestration wearing a persistence hat.
 * - The service layer is the only place that's actually allowed to say "for each of these, 
 *  do a thing" — that decision is the business logic.
 *
router.post('/images', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { image_urls } = req.body ?? [];
        console.log("image_urls", image_urls);
        if (!image_urls || !Array.isArray(image_urls)) {
            return res.status(400).json({ error: 'image_urls is required' });
        }
        const result = await enqueueIngestionPipeline(req, image_urls);
        res.status(202).json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/jobs/:queue/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { queue, id } = req.params;
        if (!['vision', 'embed'].includes(queue)) {
            return res.status(400).json({ error: 'queue must be vision or embed' });
        }
        const status = await getJobStatus(queue as 'vision' | 'embed', id);
        res.json({ jobId: id, queue, status });
    } catch (err) {
        next(err);
    }
});

export default router; */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { JobQueueService } from '../services/job-queue.service.ts';
import { container } from '../config/container.ts';

const router: Router = Router();
const jobQueueService = container.resolve('JobQueueService') as JobQueueService;

router.get('/jobs/:queue/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { queue, id } = req.params as { queue: 'vision' | 'embed' | 'post-summarize'; id: string };
        if (!queue || !id) {
            return res.status(400).json({ error: 'queue and id are required' });
        }
        if (!['vision', 'embed', 'post-summarize'].includes(queue)) {
            return res.status(400).json({ error: 'queue must be vision, embed, or post-summarize' });
        }
        const status = await jobQueueService.getJobStatus(queue, id);
        res.json({ jobId: id, queue, status });
    } catch (err) {
        next(err);
    }
});

// Get all jobs (queue is optional)
router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { queue, status, limit } = req.query as { 
            queue?: 'vision' | 'embed' | 'post-summarize'; 
            status?: string;
            limit?: string;
        };
        
        if (queue && !['vision', 'embed', 'post-summarize'].includes(queue)) {
            return res.status(400).json({ error: 'queue must be vision, embed, or post-summarize' });
        }
        
        const parsedLimit = limit ? Math.min(parseInt(limit, 10), 500) : 100;
        const jobs = await jobQueueService.getAllJobs(queue, status, parsedLimit);
        
        res.json({ jobs, total: jobs.length });
    } catch (err) {
        next(err);
    }
});

export default router;
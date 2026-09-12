import { Router, type Request, type Response, type NextFunction } from 'express';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import { EvaluationService } from '../services/evaluation.service.ts';
import { container } from '../config/container.ts';

const router: Router = Router();
const orchestrator = container.resolve('IngestionOrchestratorService') as IngestionOrchestratorService;
const evaluationService = container.resolve('EvaluationService') as EvaluationService;

router.post('/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { post_urls } = req.body ?? [];
        if (!post_urls || !Array.isArray(post_urls)) {
            return res.status(400).json({ error: 'post_urls is required' });
        }
        const result = await orchestrator.enqueuePostPipeline(post_urls);
        res.status(202).json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/posts/:id/images', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const resultsNumberParam = req.query.results_number;
        let resultsNumber = 10;
        if (resultsNumberParam) {
            const paramStr = Array.isArray(resultsNumberParam) ? resultsNumberParam[0] : resultsNumberParam;
            if (paramStr) {
                resultsNumber = parseInt(paramStr as string, 10);
            }
        }

        if (!id) {
            return res.status(400).json({ error: 'post id is required' });
        }

        const result = await evaluationService.evaluate(id as string, resultsNumber);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
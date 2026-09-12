import { Router, type Request, type Response, type NextFunction } from 'express';
import { CostLogDBRepository } from '../repositories/cost-log-db.repository.ts';
import { container } from '../config/container.ts';

const router: Router = Router();
const costLogRepo = container.resolve('CostLogDBRepository') as CostLogDBRepository;

interface CostLogQuery {
  callType?: string;
  timeRange?: string;
  limit?: string;
  refId?: string;
}

function parseTimeRange(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  
  switch (timeRange) {
    case '1h':
      start = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return { start, end: now };
}

router.get('/cost-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callType, timeRange, limit, refId } = req.query as CostLogQuery;
    
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 1000) : 100;
    const filter: any = {};
    
    if (callType && callType !== 'all') {
      filter.call_type = callType;
    }
    
    if (refId) {
      filter.ref_id = refId;
    }
    
    // Get all matching logs first, then apply time filter in memory
    // (for simplicity; could optimize with SQL WHERE clause)
    let logs = await costLogRepo.findAll(filter);
    
    if (timeRange) {
      const { start } = parseTimeRange(timeRange);
      logs = logs.filter(log => new Date(log.created_at) >= start);
    }
    
    // Sort by created_at DESC (newest first)
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Apply limit
    logs = logs.slice(0, parsedLimit);
    
    res.json({ logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});

// Get cost summary stats
router.get('/cost-log/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timeRange = '24h' } = req.query as CostLogQuery;
    const { start } = parseTimeRange(timeRange as string);
    
    const logs = await costLogRepo.findAll({});
    const filtered = logs.filter(log => new Date(log.created_at) >= start);
    
    const byType = filtered.reduce((acc, log) => {
      const type = log.call_type;
      if (!acc[type]) {
        acc[type] = { count: 0, totalCost: 0, totalTokens: 0 };
      }
      acc[type].count++;
      acc[type].totalCost += Number(log.cost_usd);
      acc[type].totalTokens += Number(log.tokens_or_units);
      return acc;
    }, {} as Record<string, { count: number; totalCost: number; totalTokens: number }>);
    
    const totalCost = filtered.reduce((sum, log) => sum + Number(log.cost_usd), 0);
    const totalCalls = filtered.length;
    
    res.json({
      timeRange,
      totalCalls,
      totalCost,
      byType,
      avgCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0
    });
  } catch (err) {
    next(err);
  }
});

export default router;
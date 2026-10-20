import { Router, type Request, type Response } from 'express';
import type { BidSearchFilters } from '../../shared/types/bid.js';
import { SearchAgent } from './searchAgent.js';
import { GemClient } from './gemClient.js';
import { getConfig } from '../../config/index.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('search:routes');

export function createSearchRoutes(): Router {
  const router = Router();

  router.post('/search', async (req: Request, res: Response) => {
    try {
      const config = getConfig();
      const filters: BidSearchFilters = {
        searchText: req.body.searchText ?? '',
        searchType: req.body.searchType,
        bidTypes: req.body.bidTypes,
        fromEndDate: req.body.fromEndDate,
        toEndDate: req.body.toEndDate,
        highValueOnly: req.body.highValueOnly,
        page: req.body.page,
        sortBy: req.body.sortBy,
        sortOrder: req.body.sortOrder,
      };

      if (filters.searchText.length < 3) {
        res.status(400).json({ error: 'Search text must be at least 3 characters' });
        return;
      }

      const client = new GemClient({
        baseUrl: config.gem.baseUrl,
        retryOptions: config.retry,
      });

      const agent = new SearchAgent(client);
      const result = await agent.execute(
        { filters },
        {
          bidId: 'search',
          workDir: config.paths.bidsDir,
          config,
          logger,
        },
      );

      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({ errors: result.errors });
      }
    } catch (err) {
      logger.error(err, 'Search route error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

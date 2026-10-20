import { Router } from 'express';
import { DownloadAgent } from './downloadAgent.js';
import { GemClient } from '../search/gemClient.js';
import { getConfig } from '../../config/index.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('download:routes');

export function createDownloadRoutes(): Router {
  const router = Router();

  router.post('/:bidId/download', async (req, res) => {
    try {
      const config = getConfig();
      const bidId = req.params.bidId as string;

      if (!bidId) {
        res.status(400).json({ error: 'Bid ID is required' });
        return;
      }

      const client = new GemClient({
        baseUrl: config.gem.baseUrl,
        retryOptions: config.retry,
      });

      const agent = new DownloadAgent(client);
      const result = await agent.execute(
        { bidId, bidNumber: req.body.bidNumber },
        {
          bidId,
          workDir: config.paths.bidsDir,
          config,
          logger,
        },
      );

      if (result.success) {
        res.json({
          message: 'Documents downloaded successfully',
          data: result.data,
          errors: result.errors,
        });
      } else {
        res.status(500).json({ errors: result.errors });
      }
    } catch (err) {
      logger.error(err, 'Download route error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

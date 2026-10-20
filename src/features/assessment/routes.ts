import { Router } from 'express';
import { AssessmentAgent } from './assessmentAgent.js';
import { createAIProvider } from '../../shared/providers/index.js';
import { getConfig } from '../../config/index.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('assessment:routes');

export function createAssessmentRoutes(): Router {
  const router = Router();

  router.post('/:bidId/assess', async (req, res) => {
    try {
      const config = getConfig();
      const bidId = req.params.bidId as string;

      if (!bidId) {
        res.status(400).json({ error: 'Bid ID is required' });
        return;
      }

      const ai = createAIProvider(config);
      const agent = new AssessmentAgent(ai);

      const result = await agent.execute(
        { bidId, proposalPath: req.body.proposalPath },
        {
          bidId,
          workDir: config.paths.bidsDir,
          config,
          logger,
        },
      );

      if (result.success) {
        res.json({
          message: 'Assessment completed successfully',
          data: result.data,
        });
      } else {
        res.status(500).json({ errors: result.errors });
      }
    } catch (err) {
      logger.error(err, 'Assessment route error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

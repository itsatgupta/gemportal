import { Router } from 'express';
import path from 'node:path';
import { ProposalAgent } from './proposalAgent.js';
import { createAIProvider } from '../../shared/providers/index.js';
import { getConfig } from '../../config/index.js';
import { getBidDocumentsDir } from '../../shared/utils/fileSystem.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('proposal:routes');

export function createProposalRoutes(): Router {
  const router = Router();

  router.post('/:bidId/proposal', async (req, res) => {
    try {
      const config = getConfig();
      const bidId = req.params.bidId as string;

      if (!bidId) {
        res.status(400).json({ error: 'Bid ID is required' });
        return;
      }

      const ai = createAIProvider(config);
      const agent = new ProposalAgent(ai);

      const documentsDir =
        req.body.documentsDir ?? getBidDocumentsDir(config.paths.bidsDir, bidId);
      const companyDocsDir =
        req.body.companyDocsDir ??
        path.resolve(config.paths.companyDocsDir);

      const result = await agent.execute(
        { bidId, documentsDir, companyDocsDir },
        {
          bidId,
          workDir: config.paths.bidsDir,
          config,
          logger,
        },
      );

      if (result.success) {
        res.json({
          message: 'Proposal generated successfully',
          data: result.data,
        });
      } else {
        res.status(500).json({ errors: result.errors });
      }
    } catch (err) {
      logger.error(err, 'Proposal route error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

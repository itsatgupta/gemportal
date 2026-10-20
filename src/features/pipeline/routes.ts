import { Router } from 'express';
import path from 'node:path';
import { GemClient } from '../search/gemClient.js';
import { DownloadAgent } from '../download/downloadAgent.js';
import { ProposalAgent } from '../proposal/proposalAgent.js';
import { AssessmentAgent } from '../assessment/assessmentAgent.js';
import { Pipeline } from '../../orchestrator/pipeline.js';
import { createAIProvider } from '../../shared/providers/index.js';
import { getConfig } from '../../config/index.js';
import { getBidDocumentsDir } from '../../shared/utils/fileSystem.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('pipeline:routes');

export function createPipelineRoutes(): Router {
  const router = Router();

  router.post('/:bidId/pipeline', async (req, res) => {
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

      const ai = createAIProvider(config);
      const companyDocsDir = path.resolve(config.paths.companyDocsDir);

      // Build the pipeline
      const pipeline = new Pipeline()
        .addStep(new DownloadAgent(client), () => ({
          bidId,
          bidNumber: req.body.bidNumber,
        }))
        .addStep(new ProposalAgent(ai), (downloadOutput: unknown) => {
          const dl = downloadOutput as { documentsDir: string } | undefined;
          return {
            bidId,
            documentsDir: dl?.documentsDir ?? getBidDocumentsDir(config.paths.bidsDir, bidId),
            companyDocsDir,
          };
        })
        .addStep(new AssessmentAgent(ai), () => ({
          bidId,
        }));

      const ctx = {
        bidId,
        workDir: config.paths.bidsDir,
        config,
        logger,
      };

      // Run pipeline (this will take time - run async)
      res.json({
        message: 'Pipeline started',
        bidId,
        hint: `Listen to SSE at /api/events/${bidId} for progress`,
      });

      // Run pipeline in background after sending response
      pipeline.execute(null, ctx).then((results) => {
        logger.info({ bidId, results: results.length }, 'Pipeline completed');
      }).catch((err) => {
        logger.error({ bidId, err }, 'Pipeline failed');
      });

    } catch (err) {
      logger.error(err, 'Pipeline route error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

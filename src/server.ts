import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './config/schema.js';
import { createSearchRoutes } from './features/search/routes.js';
import { createDownloadRoutes } from './features/download/routes.js';
import { createProposalRoutes } from './features/proposal/routes.js';
import { createAssessmentRoutes } from './features/assessment/routes.js';
import { eventBus } from './orchestrator/eventBus.js';
import { createChildLogger } from './shared/utils/logger.js';
import { createPipelineRoutes } from './features/pipeline/routes.js';

const logger = createChildLogger('server');

export function createServer(config: AppConfig) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.use('/api/bids', createSearchRoutes());
  app.use('/api/bids', createDownloadRoutes());
  app.use('/api/bids', createProposalRoutes());
  app.use('/api/bids', createAssessmentRoutes());
  app.use('/api/bids', createPipelineRoutes());

  // SSE endpoint for real-time agent progress
  app.get('/api/events/:bidId', (req, res) => {
    const { bidId } = req.params;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendEvent = (event: { agent: string; type: string; message: string; progress?: number }) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Listen to all event types for this bid
    const handlers = (['agent:start', 'agent:progress', 'agent:complete', 'agent:error'] as const).map(
      (type) => {
        const handler = (evt: { bidId: string; agent: string; message: string; progress?: number }) => {
          if (evt.bidId === bidId || bidId === 'all') {
            sendEvent({ agent: evt.agent, type, message: evt.message, progress: evt.progress });
          }
        };
        eventBus.on(type, handler);
        return { type, handler };
      },
    );

    // Cleanup on disconnect
    req.on('close', () => {
      handlers.forEach(({ type, handler }) => {
        eventBus.removeListener(type, handler);
      });
    });
  });

  // Serve bid files
  app.get('/api/bids/:bidId/files/:type/:filename', (req, res) => {
    const { bidId, type, filename } = req.params;
    const filePath = path.resolve(config.paths.bidsDir, bidId, type, filename);
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error({ err, filePath }, 'File not found');
        res.status(404).json({ error: 'File not found' });
      }
    });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve static frontend in production
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.join(__dirname, '..', 'web-dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'), (err) => {
      if (err) {
        res.status(200).json({ message: 'GemPortal API is running. Frontend not built yet.' });
      }
    });
  });

  return app;
}

import { loadConfig } from './config/index.js';
import { createServer } from './server.js';
import { logger } from './shared/utils/logger.js';

async function main() {
  try {
    const config = await loadConfig();
    const app = createServer(config);

    app.listen(config.server.port, config.server.host, () => {
      logger.info(
        `GemPortal server running at http://${config.server.host}:${config.server.port}`,
      );
      logger.info('API endpoints:');
      logger.info('  POST /api/bids/search         - Search GEM portal bids');
      logger.info('  POST /api/bids/:id/download    - Download bid documents');
      logger.info('  POST /api/bids/:id/proposal    - Generate proposal');
      logger.info('  POST /api/bids/:id/assess      - Assess proposal');
      logger.info('  POST /api/bids/:id/pipeline    - Run full pipeline');
      logger.info('  GET  /api/events/:bidId        - SSE progress stream');
    });
  } catch (err) {
    logger.fatal(err, 'Failed to start server');
    process.exit(1);
  }
}

main();

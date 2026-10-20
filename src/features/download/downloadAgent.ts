import path from 'node:path';
import type { Agent, AgentContext, AgentResult } from '../../shared/types/agent.js';
import type { BidDocument, BidMetadata } from '../../shared/types/bid.js';
import { GemClient } from '../search/gemClient.js';
import { extractDocumentLinks } from './linkExtractor.js';
import { downloadDocuments, type DownloadResult } from './downloader.js';
import { eventBus } from '../../orchestrator/eventBus.js';
import {
  ensureDir,
  getBidDocumentsDir,
  writeJson,
} from '../../shared/utils/fileSystem.js';

export interface DownloadInput {
  bidId: string;
  bidNumber?: string;
}

export interface DownloadOutput {
  documentsDir: string;
  documents: BidDocument[];
  downloadResults: DownloadResult[];
  metadata: BidMetadata;
}

export class DownloadAgent implements Agent<DownloadInput, DownloadOutput> {
  name = 'download';
  private client: GemClient;

  constructor(client: GemClient) {
    this.client = client;
  }

  async execute(
    input: DownloadInput,
    ctx: AgentContext,
  ): Promise<AgentResult<DownloadOutput>> {
    const start = Date.now();
    const { bidId } = input;

    try {
      // Step 1: Fetch bid detail page
      eventBus.emitProgress(this.name, bidId, 'Fetching bid detail page...', 10);
      const detailHtml = await this.client.getBidDetailPage(bidId);

      // Step 2: Extract document links
      eventBus.emitProgress(this.name, bidId, 'Extracting document links...', 20);
      const documents = extractDocumentLinks(detailHtml, bidId);

      if (documents.length === 0) {
        return {
          success: false,
          errors: [
            {
              code: 'NO_DOCUMENTS',
              message: 'No downloadable documents found on bid detail page',
            },
          ],
          durationMs: Date.now() - start,
        };
      }

      eventBus.emitProgress(
        this.name,
        bidId,
        `Found ${documents.length} documents to download`,
        30,
      );

      // Step 3: Create output directory
      const documentsDir = getBidDocumentsDir(ctx.config.paths.bidsDir, bidId);
      await ensureDir(documentsDir);

      // Step 4: Download all documents
      const downloadResults = await downloadDocuments(
        documents,
        documentsDir,
        this.client,
        {
          maxConcurrent: ctx.config.gem.maxConcurrentDownloads,
          retryOptions: ctx.config.retry,
          onProgress: (completed, total, current) => {
            const progress = 30 + Math.round((completed / total) * 60);
            eventBus.emitProgress(
              this.name,
              bidId,
              `Downloading ${completed}/${total}: ${current}`,
              progress,
            );
          },
        },
      );

      const successCount = downloadResults.filter((r) => r.success).length;
      const failCount = downloadResults.filter((r) => !r.success).length;

      // Step 5: Save metadata
      const metadata: BidMetadata = {
        bidId,
        bidNumber: input.bidNumber ?? bidId,
        downloadedAt: new Date().toISOString(),
        documents,
        workDir: documentsDir,
      };

      await writeJson(
        path.join(ctx.config.paths.bidsDir, bidId, 'metadata.json'),
        metadata,
      );

      eventBus.emitProgress(
        this.name,
        bidId,
        `Downloaded ${successCount} documents (${failCount} failed)`,
        100,
      );

      return {
        success: true,
        data: {
          documentsDir,
          documents,
          downloadResults,
          metadata,
        },
        errors: downloadResults
          .filter((r) => !r.success)
          .map((r) => ({
            code: 'DOWNLOAD_FAILED',
            message: `Failed to download ${r.document.filename}: ${r.error}`,
          })),
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'DOWNLOAD_AGENT_ERROR',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        durationMs: Date.now() - start,
      };
    }
  }
}

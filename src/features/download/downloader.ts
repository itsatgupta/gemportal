import fs from 'node:fs/promises';
import path from 'node:path';
import type { BidDocument } from '../../shared/types/bid.js';
import { GemClient } from '../search/gemClient.js';
import { ensureDir } from '../../shared/utils/fileSystem.js';
import { withRetry, type RetryOptions } from '../../shared/utils/retry.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('downloader');

export interface DownloadResult {
  document: BidDocument;
  filePath: string;
  success: boolean;
  error?: string;
  sizeBytes: number;
}

export async function downloadDocuments(
  documents: BidDocument[],
  outputDir: string,
  client: GemClient,
  options: {
    maxConcurrent: number;
    retryOptions: RetryOptions;
    onProgress?: (completed: number, total: number, current: string) => void;
  },
): Promise<DownloadResult[]> {
  await ensureDir(outputDir);

  const results: DownloadResult[] = [];
  const total = documents.length;

  // Process downloads with concurrency limit
  const queue = [...documents];
  const active: Promise<void>[] = [];

  let completed = 0;

  const processNext = async (): Promise<void> => {
    const doc = queue.shift();
    if (!doc) return;

    const filePath = path.join(outputDir, doc.filename);

    try {
      logger.info({ url: doc.url, filename: doc.filename }, 'Downloading');

      const buffer = await withRetry(
        () => client.downloadFile(doc.url),
        options.retryOptions,
      );

      await fs.writeFile(filePath, buffer);

      completed++;
      options.onProgress?.(completed, total, doc.filename);

      results.push({
        document: doc,
        filePath,
        success: true,
        sizeBytes: buffer.length,
      });

      logger.info(
        { filename: doc.filename, size: buffer.length },
        'Download complete',
      );
    } catch (err) {
      completed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ filename: doc.filename, error: errMsg }, 'Download failed');

      options.onProgress?.(completed, total, doc.filename);

      results.push({
        document: doc,
        filePath,
        success: false,
        error: errMsg,
        sizeBytes: 0,
      });
    }

    // Process next in queue
    if (queue.length > 0) {
      await processNext();
    }
  };

  // Start up to maxConcurrent downloads
  for (let i = 0; i < Math.min(options.maxConcurrent, documents.length); i++) {
    active.push(processNext());
  }

  await Promise.all(active);

  return results;
}

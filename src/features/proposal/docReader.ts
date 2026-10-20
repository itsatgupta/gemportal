import fs from 'node:fs/promises';
import path from 'node:path';
import { extractTextFromPdf } from '../../shared/utils/pdf.js';
import { createChildLogger } from '../../shared/utils/logger.js';

const logger = createChildLogger('docReader');

export interface DocumentContent {
  filename: string;
  text: string;
  type: 'pdf' | 'text' | 'unknown';
  sizeChars: number;
}

export async function readAllDocuments(
  dirPath: string,
): Promise<DocumentContent[]> {
  const results: DocumentContent[] = [];
  let files: string[];

  try {
    files = await fs.readdir(dirPath);
  } catch {
    logger.warn({ dirPath }, 'Directory not found');
    return results;
  }

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const ext = path.extname(file).toLowerCase();

    try {
      if (ext === '.pdf') {
        const text = await extractTextFromPdf(filePath);
        results.push({
          filename: file,
          text,
          type: 'pdf',
          sizeChars: text.length,
        });
      } else if (['.txt', '.md', '.csv'].includes(ext)) {
        const text = await fs.readFile(filePath, 'utf-8');
        results.push({
          filename: file,
          text,
          type: 'text',
          sizeChars: text.length,
        });
      } else {
        logger.info({ file }, 'Skipping unsupported file type');
        results.push({
          filename: file,
          text: `[Binary file: ${file}]`,
          type: 'unknown',
          sizeChars: 0,
        });
      }
    } catch (err) {
      logger.error({ file, error: err }, 'Failed to read document');
      results.push({
        filename: file,
        text: `[Error reading file: ${err}]`,
        type: 'unknown',
        sizeChars: 0,
      });
    }
  }

  return results;
}

export function summarizeDocuments(docs: DocumentContent[]): string {
  return docs
    .filter((d) => d.sizeChars > 0)
    .map((d) => `--- ${d.filename} ---\n${d.text}`)
    .join('\n\n');
}

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n...[truncated]';
}

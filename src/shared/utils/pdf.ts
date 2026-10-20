import fs from 'node:fs/promises';
import path from 'node:path';

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  // pdf-parse uses dynamic import for compatibility
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractTextFromAllPdfs(
  dirPath: string,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const files = await fs.readdir(dirPath);
  const pdfFiles = files.filter((f) => f.toLowerCase().endsWith('.pdf'));

  for (const file of pdfFiles) {
    try {
      const text = await extractTextFromPdf(path.join(dirPath, file));
      results.set(file, text);
    } catch (err) {
      results.set(file, `[Error extracting text: ${err}]`);
    }
  }

  return results;
}

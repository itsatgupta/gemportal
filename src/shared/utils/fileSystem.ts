import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function getBidDir(bidsRoot: string, bidId: string): string {
  return path.join(bidsRoot, bidId);
}

export function getBidDocumentsDir(bidsRoot: string, bidId: string): string {
  return path.join(bidsRoot, bidId, 'documents');
}

export function getBidProposalsDir(bidsRoot: string, bidId: string): string {
  return path.join(bidsRoot, bidId, 'proposals');
}

export function getBidAssessmentsDir(bidsRoot: string, bidId: string): string {
  return path.join(bidsRoot, bidId, 'assessments');
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

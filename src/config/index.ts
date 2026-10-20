import dotenv from 'dotenv';
import { appConfigSchema, type AppConfig } from './schema.js';

dotenv.config();

let _config: AppConfig | null = null;

const DEFAULT_CONFIG: AppConfig = {
  server: { port: 3000, host: 'localhost' },
  gem: {
    baseUrl: 'https://bidplus.gem.gov.in',
    searchEndpoint: '/all-bids-data',
    requestDelayMs: 1000,
    maxConcurrentDownloads: 3,
    sessionRefreshMs: 300_000,
  },
  paths: {
    bidsDir: './bids',
    companyDocsDir: './bidsupportingdocs',
    sampleDocsDir: './Samplebiddocs',
  },
  ai: {
    provider: 'claude',
    claude: { model: 'claude-sonnet-4-20250514', maxTokens: 4096, temperature: 0.3 },
    openai: { model: 'gpt-4o', maxTokens: 4096, temperature: 0.3 },
  },
  retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10_000 },
};

export async function loadConfig(): Promise<AppConfig> {
  if (_config) return _config;

  const raw = { ...DEFAULT_CONFIG };

  // Override with env vars
  if (process.env.PORT) raw.server.port = Number(process.env.PORT);
  if (process.env.HOST) raw.server.host = process.env.HOST;
  if (process.env.AI_PROVIDER) {
    raw.ai = { ...raw.ai, provider: process.env.AI_PROVIDER as 'claude' | 'openai' };
  }

  _config = appConfigSchema.parse(raw);
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.');
  return _config;
}

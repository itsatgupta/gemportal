import type { AppConfig } from './src/config/schema.js';

const config: AppConfig = {
  server: {
    port: 3000,
    host: 'localhost',
  },
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
    claude: {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      temperature: 0.3,
    },
    openai: {
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.3,
    },
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10_000,
  },
};

export default config;

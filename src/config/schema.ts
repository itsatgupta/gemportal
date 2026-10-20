import { z } from 'zod';

export const appConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost'),
  }),
  gem: z.object({
    baseUrl: z.string().url(),
    searchEndpoint: z.string(),
    requestDelayMs: z.number().default(1000),
    maxConcurrentDownloads: z.number().default(3),
    sessionRefreshMs: z.number().default(300_000),
  }),
  paths: z.object({
    bidsDir: z.string().default('./bids'),
    companyDocsDir: z.string().default('./bidsupportingdocs'),
    sampleDocsDir: z.string().default('./Samplebiddocs'),
  }),
  ai: z.object({
    provider: z.enum(['claude', 'openai']).default('claude'),
    claude: z.object({
      model: z.string().default('claude-sonnet-4-20250514'),
      maxTokens: z.number().default(4096),
      temperature: z.number().default(0.3),
    }),
    openai: z.object({
      model: z.string().default('gpt-4o'),
      maxTokens: z.number().default(4096),
      temperature: z.number().default(0.3),
    }),
  }),
  retry: z.object({
    maxAttempts: z.number().default(3),
    baseDelayMs: z.number().default(1000),
    maxDelayMs: z.number().default(10_000),
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

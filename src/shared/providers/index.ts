import type { AIProvider } from './aiProvider.js';
import type { AppConfig } from '../../config/schema.js';
import { ClaudeProvider } from './claudeProvider.js';
import { OpenAIProvider } from './openaiProvider.js';

export { type AIProvider, type AIGenerateOptions } from './aiProvider.js';
export { ClaudeProvider } from './claudeProvider.js';
export { OpenAIProvider } from './openaiProvider.js';

export function createAIProvider(config: AppConfig): AIProvider {
  switch (config.ai.provider) {
    case 'claude':
      return new ClaudeProvider({
        model: config.ai.claude.model,
        maxTokens: config.ai.claude.maxTokens,
        temperature: config.ai.claude.temperature,
      });
    case 'openai':
      return new OpenAIProvider({
        model: config.ai.openai.model,
        maxTokens: config.ai.openai.maxTokens,
        temperature: config.ai.openai.temperature,
      });
    default:
      throw new Error(`Unknown AI provider: ${config.ai.provider}`);
  }
}

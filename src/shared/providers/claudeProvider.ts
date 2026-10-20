import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIGenerateOptions } from './aiProvider.js';
import { AIProviderError } from '../errors/index.js';

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    const apiKey = options?.apiKey ?? process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new AIProviderError('CLAUDE_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey });
    this.defaultModel = options?.model ?? 'claude-sonnet-4-20250514';
    this.defaultMaxTokens = options?.maxTokens ?? 4096;
    this.defaultTemperature = options?.temperature ?? 0.3;
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerateOptions,
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: options?.model ?? this.defaultModel,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        temperature: options?.temperature ?? this.defaultTemperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AIProviderError('No text in Claude response');
      }
      return textBlock.text;
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(`Claude API error: ${err}`);
    }
  }
}

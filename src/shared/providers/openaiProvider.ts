import OpenAI from 'openai';
import type { AIProvider, AIGenerateOptions } from './aiProvider.js';
import { AIProviderError } from '../errors/index.js';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AIProviderError('OPENAI_API_KEY is required');
    }
    this.client = new OpenAI({ apiKey });
    this.defaultModel = options?.model ?? 'gpt-4o';
    this.defaultMaxTokens = options?.maxTokens ?? 4096;
    this.defaultTemperature = options?.temperature ?? 0.3;
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerateOptions,
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model ?? this.defaultModel,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        temperature: options?.temperature ?? this.defaultTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new AIProviderError('No content in OpenAI response');
      }
      return content;
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(`OpenAI API error: ${err}`);
    }
  }
}

export interface AIGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AIProvider {
  name: string;
  generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerateOptions,
  ): Promise<string>;
}

export type AIProviderFactory = () => AIProvider;

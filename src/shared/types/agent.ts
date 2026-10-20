import type { AppConfig } from '../../config/schema.js';
import type { Logger } from 'pino';

export interface AgentContext {
  bidId: string;
  workDir: string;
  config: AppConfig;
  logger: Logger;
  signal?: AbortSignal;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  errors: AgentError[];
  durationMs: number;
}

export interface AgentError {
  code: string;
  message: string;
  details?: unknown;
}

export interface Agent<TInput, TOutput> {
  name: string;
  execute(input: TInput, ctx: AgentContext): Promise<AgentResult<TOutput>>;
}

export type AgentEventType =
  | 'agent:start'
  | 'agent:progress'
  | 'agent:complete'
  | 'agent:error';

export interface AgentEvent {
  agent: string;
  type: AgentEventType;
  bidId: string;
  message: string;
  progress?: number;
  timestamp: Date;
}

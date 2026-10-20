import { EventEmitter } from 'node:events';
import type { AgentEvent, AgentEventType } from '../shared/types/agent.js';

export class AgentEventBus extends EventEmitter {
  emit(type: AgentEventType, event: AgentEvent): boolean {
    return super.emit(type, event);
  }

  on(type: AgentEventType, listener: (event: AgentEvent) => void): this {
    return super.on(type, listener);
  }

  emitStart(agent: string, bidId: string, message: string): void {
    this.emit('agent:start', {
      agent,
      type: 'agent:start',
      bidId,
      message,
      progress: 0,
      timestamp: new Date(),
    });
  }

  emitProgress(
    agent: string,
    bidId: string,
    message: string,
    progress: number,
  ): void {
    this.emit('agent:progress', {
      agent,
      type: 'agent:progress',
      bidId,
      message,
      progress,
      timestamp: new Date(),
    });
  }

  emitComplete(agent: string, bidId: string, message: string): void {
    this.emit('agent:complete', {
      agent,
      type: 'agent:complete',
      bidId,
      message,
      progress: 100,
      timestamp: new Date(),
    });
  }

  emitError(agent: string, bidId: string, message: string): void {
    this.emit('agent:error', {
      agent,
      type: 'agent:error',
      bidId,
      message,
      timestamp: new Date(),
    });
  }
}

// Singleton event bus
export const eventBus = new AgentEventBus();

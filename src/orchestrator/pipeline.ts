import type { Agent, AgentContext, AgentResult } from '../shared/types/agent.js';
import { eventBus } from './eventBus.js';
import { createChildLogger } from '../shared/utils/logger.js';

const logger = createChildLogger('pipeline');

export interface PipelineStep<TIn, TOut> {
  agent: Agent<TIn, TOut>;
  mapInput: (prev: unknown) => TIn;
}

export class Pipeline {
  private steps: PipelineStep<unknown, unknown>[] = [];

  addStep<TIn, TOut>(
    agent: Agent<TIn, TOut>,
    mapInput: (prev: unknown) => TIn,
  ): Pipeline {
    this.steps.push({
      agent: agent as Agent<unknown, unknown>,
      mapInput,
    });
    return this;
  }

  async execute(
    initialInput: unknown,
    ctx: AgentContext,
  ): Promise<AgentResult<unknown>[]> {
    const results: AgentResult<unknown>[] = [];
    let currentInput = initialInput;

    for (const step of this.steps) {
      const { agent, mapInput } = step;
      const input = mapInput(currentInput);

      logger.info({ agent: agent.name, bidId: ctx.bidId }, 'Starting agent');
      eventBus.emitStart(agent.name, ctx.bidId, `Starting ${agent.name}`);

      const start = Date.now();
      try {
        const result = await agent.execute(input, ctx);
        result.durationMs = Date.now() - start;
        results.push(result);

        if (!result.success) {
          eventBus.emitError(
            agent.name,
            ctx.bidId,
            `${agent.name} failed: ${result.errors.map((e) => e.message).join(', ')}`,
          );
          logger.error({ agent: agent.name, errors: result.errors }, 'Agent failed');
          break;
        }

        eventBus.emitComplete(
          agent.name,
          ctx.bidId,
          `${agent.name} completed`,
        );
        currentInput = result.data;
      } catch (err) {
        const duration = Date.now() - start;
        const errMsg = err instanceof Error ? err.message : String(err);
        eventBus.emitError(agent.name, ctx.bidId, errMsg);
        results.push({
          success: false,
          errors: [{ code: 'UNHANDLED', message: errMsg }],
          durationMs: duration,
        });
        break;
      }
    }

    return results;
  }
}

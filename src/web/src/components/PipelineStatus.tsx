import React from 'react';
import type { AgentEvent } from '../services/api.js';

interface Props {
  events: AgentEvent[];
}

export default function PipelineStatus({ events }: Props) {
  if (events.length === 0) return null;

  // Group events by agent
  const agentEvents = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const existing = agentEvents.get(event.agent) ?? [];
    existing.push(event);
    agentEvents.set(event.agent, existing);
  }

  const agentNames: Record<string, string> = {
    search: 'Search Agent',
    download: 'Download Agent',
    proposal: 'Proposal Agent',
    assessment: 'Assessment Agent',
  };

  const agentColors: Record<string, string> = {
    search: 'bg-blue-500',
    download: 'bg-cyan-500',
    proposal: 'bg-purple-500',
    assessment: 'bg-amber-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        Pipeline Progress
      </h3>

      <div className="space-y-4">
        {[...agentEvents.entries()].map(([agent, agentEvts]) => {
          const latest = agentEvts[agentEvts.length - 1];
          const progress = latest.progress ?? 0;
          const isComplete = latest.type === 'agent:complete';
          const isError = latest.type === 'agent:error';

          return (
            <div key={agent}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">
                  {agentNames[agent] ?? agent}
                </span>
                <span
                  className={`text-xs font-medium ${
                    isError
                      ? 'text-red-600'
                      : isComplete
                        ? 'text-green-600'
                        : 'text-slate-500'
                  }`}
                >
                  {latest.message}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isError
                      ? 'bg-red-500'
                      : isComplete
                        ? 'bg-green-500'
                        : agentColors[agent] ?? 'bg-indigo-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Event log */}
      <details className="mt-4">
        <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
          Show event log ({events.length} events)
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto bg-slate-50 rounded-lg p-3">
          {events.map((evt, i) => (
            <div key={i} className="text-xs text-slate-600 py-0.5 font-mono">
              <span className="text-slate-400">[{evt.agent}]</span>{' '}
              {evt.message}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

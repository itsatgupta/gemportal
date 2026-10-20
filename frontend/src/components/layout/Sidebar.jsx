import { Search, FileText, Scale, Bot } from 'lucide-react'
import useBidStore from '../../store/bidStore'
import AgentTimeline from '../agents/AgentTimeline'

const STATUS_COLORS = {
  idle: 'bg-slate-500',
  searching: 'bg-agent-search',
  downloading: 'bg-agent-search',
  extracting_links: 'bg-agent-search',
  complete: 'bg-emerald-400',
  error: 'bg-red-400',
  reading_docs: 'bg-agent-proposer',
  drafting: 'bg-agent-proposer',
  proposal_ready: 'bg-emerald-400',
  receiving_gaps: 'bg-amber-400',
  revising: 'bg-agent-proposer',
  revised_ready: 'bg-emerald-400',
  reviewing: 'bg-agent-assessor',
  gaps_found: 'bg-amber-400',
  sent_to_agent2: 'bg-amber-400',
  re_reviewing: 'bg-agent-assessor',
  approved: 'bg-emerald-400',
  conditionally_approved: 'bg-yellow-400',
}

const agents = [
  { key: 'search_agent', label: 'Search Agent', icon: Search, color: 'text-agent-search', bg: 'bg-agent-search/15' },
  { key: 'bid_proposer_agent', label: 'Proposer Agent', icon: FileText, color: 'text-agent-proposer', bg: 'bg-agent-proposer/15' },
  { key: 'bid_assessor_agent', label: 'Assessor Agent', icon: Scale, color: 'text-agent-assessor', bg: 'bg-agent-assessor/15' },
  { key: 'qa_agent', label: 'QA Agent', icon: Bot, color: 'text-agent-qa', bg: 'bg-agent-qa/15' },
]

export default function Sidebar() {
  const { agentStatuses, messages } = useBidStore()

  return (
    <aside className="w-64 bg-secondary/80 border-r border-slate-600/30 flex flex-col backdrop-blur-sm">
      {/* Agent Status Panel */}
      <div className="p-4 border-b border-slate-600/20">
        <h2 className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest mb-3">Agents</h2>
        <div className="space-y-2">
          {agents.map(({ key, label, icon: Icon, color, bg }) => {
            const status = agentStatuses[key]?.status || 'idle'
            const detail = agentStatuses[key]?.detail || ''
            const dotColor = STATUS_COLORS[status] || 'bg-slate-500'
            const isActive = status !== 'idle'

            return (
              <div key={key} className={`p-2.5 rounded-lg border transition-all ${isActive ? 'bg-card border-cyan-500/20 shadow-sm shadow-cyan-900/20' : 'bg-transparent border-transparent'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <span className="text-sm font-medium text-slate-200 flex-1">{label}</span>
                  <div className={`w-2 h-2 rounded-full ${dotColor} ${isActive ? 'animate-pulse-dot' : ''}`} />
                </div>
                {detail && (
                  <p className="text-[11px] text-slate-400 mt-1.5 ml-[38px] truncate">{detail}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline Timeline */}
      <div className="border-b border-slate-600/20">
        <AgentTimeline />
      </div>

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest mb-3">Activity Feed</h2>
        <div className="space-y-2">
          {messages.slice(-20).reverse().map((msg, i) => (
            <div key={i} className="text-xs font-mono p-2.5 bg-card/60 rounded-lg border border-slate-600/15">
              <div className="flex items-center gap-1.5 text-cyan-300/70">
                <span className="font-semibold">{msg.from_agent?.replace('_agent', '')}</span>
                <span className="text-slate-500">&rarr;</span>
                <span className="font-semibold">{msg.to_agent?.replace('_agent', '')}</span>
              </div>
              <p className="text-slate-300 mt-1">{msg.message_type?.replace(/_/g, ' ')}</p>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-xs text-slate-500 italic">No activity yet</p>
          )}
        </div>
      </div>
    </aside>
  )
}

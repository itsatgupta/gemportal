import { Search, FileText, Scale, Bot } from 'lucide-react'
import { motion } from 'framer-motion'

const AGENT_CONFIG = {
  search_agent: { label: 'Search Agent', desc: 'Bid Discovery & Document Acquisition', icon: Search, color: 'agent-search', gradient: 'from-blue-500/20 to-blue-600/10' },
  bid_proposer_agent: { label: 'Proposer Agent', desc: 'Bid Proposal Generation', icon: FileText, color: 'agent-proposer', gradient: 'from-emerald-500/20 to-emerald-600/10' },
  bid_assessor_agent: { label: 'Assessor Agent', desc: 'Quality Assessment & Gap Analysis', icon: Scale, color: 'agent-assessor', gradient: 'from-amber-500/20 to-amber-600/10' },
  qa_agent: { label: 'QA Agent', desc: 'Application Quality Assurance', icon: Bot, color: 'agent-qa', gradient: 'from-purple-500/20 to-purple-600/10' },
}

const STATUS_LABELS = {
  idle: 'Idle',
  searching: 'Searching',
  downloading: 'Downloading',
  extracting_links: 'Extracting Links',
  complete: 'Complete',
  error: 'Error',
  reading_docs: 'Reading Documents',
  drafting: 'Drafting Proposal',
  proposal_ready: 'Proposal Ready',
  receiving_gaps: 'Receiving Gaps',
  revising: 'Revising',
  revised_ready: 'Revision Ready',
  reviewing: 'Reviewing',
  gaps_found: 'Gaps Found',
  sent_to_agent2: 'Sent to Proposer',
  re_reviewing: 'Re-reviewing',
  approved: 'Approved',
  conditionally_approved: 'Conditionally Approved',
}

export default function AgentCard({ agentKey, status, detail }) {
  const config = AGENT_CONFIG[agentKey] || AGENT_CONFIG.qa_agent
  const Icon = config.icon
  const isActive = status && status !== 'idle'
  const isComplete = ['complete', 'proposal_ready', 'revised_ready', 'approved'].includes(status)
  const isError = status === 'error'

  return (
    <motion.div
      layout
      className={`relative p-4 rounded-xl border transition-all overflow-hidden ${
        isActive
          ? `bg-gradient-to-br ${config.gradient} border-${config.color}/30 shadow-lg shadow-${config.color}/10`
          : 'bg-card/60 border-slate-600/15'
      }`}
    >
      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId={`active-${agentKey}`}
          className={`absolute top-0 left-0 right-0 h-0.5 bg-${config.color}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
        />
      )}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg bg-${config.color}/15 flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 text-${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">{config.label}</h3>
            <div className={`w-2.5 h-2.5 rounded-full ${
              isError ? 'bg-red-400' : isComplete ? 'bg-emerald-400' : isActive ? `bg-${config.color} animate-pulse-dot` : 'bg-slate-500'
            }`} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{config.desc}</p>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2"
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${
                isError ? 'bg-red-400/15 text-red-300' : isComplete ? 'bg-emerald-400/15 text-emerald-300' : `bg-${config.color}/15 text-${config.color}`
              }`}>
                {STATUS_LABELS[status] || status}
              </span>
              {detail && <p className="text-[11px] text-slate-400 mt-1 truncate">{detail}</p>}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

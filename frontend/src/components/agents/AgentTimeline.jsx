import { Check, Circle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import useBidStore from '../../store/bidStore'

const PIPELINE_STEPS = [
  { key: 'search', agent: 'search_agent', label: 'Search & Download', activeStates: ['searching', 'downloading', 'extracting_links'], doneStates: ['complete'] },
  { key: 'propose', agent: 'bid_proposer_agent', label: 'Generate Proposal', activeStates: ['reading_docs', 'drafting'], doneStates: ['proposal_ready', 'revised_ready'] },
  { key: 'assess', agent: 'bid_assessor_agent', label: 'Assessment', activeStates: ['reviewing', 're_reviewing'], doneStates: ['approved', 'conditionally_approved'] },
  { key: 'gaps', agent: 'bid_assessor_agent', label: 'Gap Resolution', activeStates: ['gaps_found', 'sent_to_agent2'], doneStates: ['approved', 'conditionally_approved'] },
  { key: 'approve', agent: 'bid_assessor_agent', label: 'Final Approval', activeStates: [], doneStates: ['approved', 'conditionally_approved'] },
]

function StepNode({ step, status }) {
  const isDone = status === 'done'
  const isActive = status === 'active'

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex flex-col items-center">
        {isDone ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-7 h-7 rounded-full bg-emerald-400/20 border-2 border-emerald-400 flex items-center justify-center"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </motion.div>
        ) : isActive ? (
          <div className="w-7 h-7 rounded-full bg-cyan-400/20 border-2 border-cyan-400 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-card border-2 border-slate-600 flex items-center justify-center">
            <Circle className="w-3 h-3 text-slate-600" />
          </div>
        )}
      </div>
      <span className={`text-sm ${isDone ? 'text-emerald-300' : isActive ? 'text-cyan-300 font-medium' : 'text-slate-500'}`}>
        {step.label}
      </span>
    </div>
  )
}

export default function AgentTimeline() {
  const { agentStatuses } = useBidStore()

  function getStepStatus(step) {
    const agentStatus = agentStatuses[step.agent]?.status || 'idle'
    if (step.doneStates.includes(agentStatus)) return 'done'
    if (step.activeStates.includes(agentStatus)) return 'active'
    return 'pending'
  }

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-4">Pipeline</h3>
      <div className="space-y-1">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.key}>
            <StepNode step={step} status={getStepStatus(step)} />
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="ml-[13px] w-px h-4 bg-slate-600/40" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

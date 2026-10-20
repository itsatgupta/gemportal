import { useRef, useEffect } from 'react'
import { Search, FileText, Scale, Bot, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useBidStore from '../../store/bidStore'
import StatusBadge from '../shared/StatusBadge'

const AGENT_META = {
  search_agent: { label: 'Search Agent', icon: Search, color: 'bg-agent-search', text: 'text-blue-300', ring: 'ring-agent-search/30' },
  bid_proposer_agent: { label: 'Proposer', icon: FileText, color: 'bg-agent-proposer', text: 'text-emerald-300', ring: 'ring-agent-proposer/30' },
  bid_assessor_agent: { label: 'Assessor', icon: Scale, color: 'bg-agent-assessor', text: 'text-amber-300', ring: 'ring-agent-assessor/30' },
  qa_agent: { label: 'QA Agent', icon: Bot, color: 'bg-agent-qa', text: 'text-purple-300', ring: 'ring-agent-qa/30' },
}

function AgentAvatar({ agentKey, size = 'sm' }) {
  const meta = AGENT_META[agentKey] || AGENT_META.qa_agent
  const Icon = meta.icon
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const iconDim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'

  return (
    <div className={`${dim} rounded-full ${meta.color}/20 ring-2 ${meta.ring} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`${iconDim} ${meta.text}`} />
    </div>
  )
}

function GapInline({ gaps }) {
  if (!gaps || gaps.length === 0) return null
  return (
    <div className="mt-2 space-y-1.5">
      {gaps.slice(0, 5).map((g, i) => (
        <div key={g.gap_id || i} className="flex items-start gap-2 text-xs bg-card/60 rounded-lg p-2 border border-slate-600/15">
          <StatusBadge type={g.severity} label={g.severity} />
          <div>
            <span className="text-slate-300 font-medium">{g.section}</span>
            <span className="text-slate-500 ml-1">— {g.description}</span>
          </div>
        </div>
      ))}
      {gaps.length > 5 && (
        <p className="text-xs text-slate-500 italic">+ {gaps.length - 5} more gaps</p>
      )}
    </div>
  )
}

function MessageBubble({ msg, index }) {
  const meta = AGENT_META[msg.from_agent] || AGENT_META.qa_agent
  const isLeft = msg.from_agent === 'bid_assessor_agent' || msg.from_agent === 'search_agent'
  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  const typeLabel = (msg.message_type || '').replace(/_/g, ' ')
  const isGapReport = msg.message_type === 'gap_report'
  const isApproval = msg.message_type === 'approval'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex gap-3 ${isLeft ? '' : 'flex-row-reverse'}`}
    >
      <AgentAvatar agentKey={msg.from_agent} />
      <div className={`max-w-[75%] ${isLeft ? '' : 'text-right'}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 ${isLeft ? '' : 'justify-end'}`}>
          <span className={`text-xs font-semibold ${meta.text}`}>{meta.label}</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className="text-xs text-slate-500">
            {AGENT_META[msg.to_agent]?.label || msg.to_agent}
          </span>
          {time && <span className="text-[10px] text-slate-600 ml-1">{time}</span>}
        </div>
        {/* Bubble */}
        <div className={`rounded-xl p-3 border ${
          isApproval
            ? 'bg-emerald-500/10 border-emerald-400/25'
            : isGapReport
              ? 'bg-amber-500/10 border-amber-400/20'
              : 'bg-card/80 border-slate-500/15'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isApproval && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {isGapReport && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            <span className="text-sm font-medium text-slate-200 capitalize">{typeLabel}</span>
          </div>
          {isApproval && msg.payload?.verdict && (
            <p className="text-sm text-emerald-300 font-semibold">{msg.payload.verdict}</p>
          )}
          {isGapReport && <GapInline gaps={msg.payload?.gaps} />}
          {!isGapReport && !isApproval && msg.payload && (
            <p className="text-xs text-slate-400 mt-1">
              {JSON.stringify(msg.payload).slice(0, 120)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function AgentChatThread({ bidNumber }) {
  const { messages } = useBidStore()
  const scrollRef = useRef(null)

  const filtered = bidNumber
    ? messages.filter((m) => m.bid_number === bidNumber)
    : messages

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filtered.length])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-600/20 bg-elevated/30">
        <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">Agent Communication</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500">Agent messages will appear here during the bid workflow</p>
            </div>
          ) : (
            filtered.map((msg, i) => (
              <MessageBubble key={msg.timestamp + '-' + i} msg={msg} index={i} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

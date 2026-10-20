import { useEffect } from 'react'
import { Scale, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'
import useBidStore from '../../store/bidStore'
import GapReportCard from '../shared/GapReportCard'
import AgentChatThread from '../agents/AgentChatThread'

export default function AssessmentTab() {
  const {
    selectedBid, agentStatuses, gaps, setGaps,
    verdict, setVerdict, summary, setSummary,
  } = useBidStore()

  const bidNumber = selectedBid?.bid_number || ''
  const assessorStatus = agentStatuses.bid_assessor_agent?.status || 'idle'

  useEffect(() => {
    if (!bidNumber) return
    if (assessorStatus === 'approved' || assessorStatus === 'conditionally_approved') {
      axios.get(`/api/assessments/${encodeURIComponent(bidNumber)}/summary`).then(({ data }) => {
        if (data.summary) setSummary(data.summary)
      }).catch(() => {})
    }
    if (assessorStatus === 'gaps_found' || assessorStatus === 'sent_to_agent2') {
      axios.get(`/api/assessments/${encodeURIComponent(bidNumber)}/gaps`).then(({ data }) => {
        if (data.gaps) setGaps(data.gaps)
      }).catch(() => {})
    }
  }, [assessorStatus, bidNumber])

  const resolvedCount = gaps.filter((g) => g.status === 'resolved').length
  const totalGaps = gaps.length
  const progressPct = totalGaps > 0 ? (resolvedCount / totalGaps) * 100 : 0

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-white mb-2">Assessment</h2>
            <p className="text-sm text-slate-400">AI-powered gap analysis and quality assessment of your proposal</p>
          </div>

          {/* Assessor Status */}
          {assessorStatus !== 'idle' && (
            <div className="mb-6 p-3.5 bg-agent-assessor/10 border border-agent-assessor/25 rounded-xl flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-agent-assessor animate-pulse-dot" />
              <span className="text-sm text-amber-300 font-mono">
                Agent 3: {agentStatuses.bid_assessor_agent?.detail || assessorStatus}
              </span>
            </div>
          )}

          {/* Gap Report */}
          {gaps.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Gap Report</h3>

              {/* Resolution Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Resolution Progress</span>
                  <span className="text-slate-300 font-medium">{resolvedCount}/{totalGaps} resolved</span>
                </div>
                <div className="h-2.5 bg-card rounded-full overflow-hidden border border-slate-600/20">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Gap Cards */}
              <div className="space-y-3">
                {gaps.map((gap, i) => (
                  <GapReportCard key={gap.gap_id || i} gap={gap} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Verdict Card */}
          {verdict && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-8 rounded-2xl border-2 text-center ${
                verdict === 'APPROVED'
                  ? 'bg-emerald-500/10 border-emerald-400/30'
                  : 'bg-yellow-500/10 border-yellow-400/30'
              }`}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                {verdict === 'APPROVED' ? (
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                ) : (
                  <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                )}
              </motion.div>
              <h3 className={`font-display text-2xl font-bold mb-2 ${
                verdict === 'APPROVED' ? 'text-emerald-300' : 'text-yellow-300'
              }`}>
                {verdict}
              </h3>
              <p className="text-sm text-slate-400">
                {verdict === 'APPROVED'
                  ? 'All requirements met. Proposal is ready for submission.'
                  : 'Minor issues remain. Proposal may be submitted with noted conditions.'}
              </p>
            </motion.div>
          )}

          {/* Loading state */}
          {assessorStatus === 'reviewing' && gaps.length === 0 && (
            <div className="text-center py-12">
              <Scale className="w-12 h-12 text-agent-assessor mx-auto mb-4 animate-pulse" />
              <p className="text-slate-400">Assessor is reviewing the proposal...</p>
            </div>
          )}

          {/* No bid selected */}
          {!bidNumber && assessorStatus === 'idle' && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500">Assessment will begin automatically after a proposal is generated</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Thread sidebar */}
      <div className="w-80 border-l border-slate-600/20 bg-secondary/50 flex flex-col">
        <AgentChatThread bidNumber={bidNumber} />
      </div>
    </div>
  )
}

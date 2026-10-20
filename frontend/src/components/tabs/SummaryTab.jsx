import { useEffect } from 'react'
import { Download, FileCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'
import useBidStore from '../../store/bidStore'
import ApprovalSeal from '../shared/ApprovalSeal'
import GapReportCard from '../shared/GapReportCard'

export default function SummaryTab() {
  const { selectedBid, summary, setSummary, verdict, gaps } = useBidStore()
  const bidNumber = selectedBid?.bid_number || ''

  useEffect(() => {
    if (!bidNumber) return
    axios.get(`/api/assessments/${encodeURIComponent(bidNumber)}/summary`).then(({ data }) => {
      if (data.summary) setSummary(data.summary)
    }).catch(() => {})
  }, [bidNumber])

  if (!summary && !verdict) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <FileCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="font-display text-xl text-slate-300 mb-2">No Summary Available Yet</h2>
        <p className="text-sm text-slate-500">
          Complete the search, proposal, and assessment stages to see the final summary.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-white mb-2">Final Summary</h2>
        {bidNumber && <p className="text-sm text-cyan-300/70 font-mono">Bid: {bidNumber}</p>}
      </div>

      {/* Approval Seal */}
      {verdict && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-10"
        >
          <ApprovalSeal verdict={verdict} />
        </motion.div>
      )}

      {/* Resolution Matrix */}
      {gaps.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div className="bg-card/80 border border-slate-500/15 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-cyan-300/80 uppercase tracking-widest mb-3">Initial Observations</h3>
            <div className="space-y-2">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    g.severity === 'Critical' ? 'bg-red-400' : g.severity === 'Major' ? 'bg-orange-400' : 'bg-yellow-400'
                  }`} />
                  <span>{g.section}: {g.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card/80 border border-slate-500/15 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-cyan-300/80 uppercase tracking-widest mb-3">Re-Review Findings</h3>
            <div className="space-y-2">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {g.status === 'resolved' || g.severity === 'Minor' ? (
                    <span className="text-emerald-400 font-medium text-xs">Resolved</span>
                  ) : (
                    <span className="text-amber-400 font-medium text-xs">Open</span>
                  )}
                  <span className="text-slate-500">- {g.gap_id}: {g.section}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Text */}
      {summary && (
        <div className="bg-card/80 border border-slate-500/15 rounded-xl p-6 mb-8">
          <h3 className="text-xs font-semibold text-cyan-300/80 uppercase tracking-widest mb-4">Assessment Summary</h3>
          <pre className="font-mono text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {summary}
          </pre>
        </div>
      )}

      {/* Export Buttons */}
      <div className="flex gap-4">
        {bidNumber && (
          <a
            href={`/api/proposals/${encodeURIComponent(bidNumber)}/pdf`}
            download
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl hover:from-cyan-400 hover:to-teal-400 transition-all shadow-md shadow-cyan-900/30"
          >
            <Download className="w-4 h-4" />
            Download Proposal PDF
          </a>
        )}
        {bidNumber && (
          <a
            href={`/api/bids/${encodeURIComponent(bidNumber)}/package`}
            download
            className="flex items-center gap-2 px-6 py-3 bg-card border border-slate-500/25 text-slate-200 rounded-xl hover:bg-elevated hover:border-cyan-400/20 transition-all"
          >
            <Download className="w-4 h-4" />
            Download Full Package
          </a>
        )}
      </div>
    </div>
  )
}

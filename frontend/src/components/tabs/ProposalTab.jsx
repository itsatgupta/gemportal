import { useState, useEffect } from 'react'
import { FileText, AlertTriangle, RefreshCw, Download, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'
import useBidStore from '../../store/bidStore'
import StatusBadge from '../shared/StatusBadge'
import DocumentViewer from '../shared/DocumentViewer'
import GapReportCard from '../shared/GapReportCard'

export default function ProposalTab() {
  const {
    selectedBid, agentStatuses, proposal, setProposal,
    proposalLoading, setProposalLoading, gaps, addToast,
  } = useBidStore()
  const [availableBids, setAvailableBids] = useState([])
  const [chosenBid, setChosenBid] = useState('')
  const [hasPdf, setHasPdf] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [readiness, setReadiness] = useState(null)

  useEffect(() => {
    axios.get('/api/bids/list').then(({ data }) => {
      setAvailableBids(data.bids || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedBid?.bid_number) {
      setChosenBid(selectedBid.bid_number)
    }
  }, [selectedBid])

  useEffect(() => {
    if (!chosenBid) {
      setReadiness(null)
      return
    }
    axios.get(`/api/bids/${encodeURIComponent(chosenBid)}/readiness`)
      .then(({ data }) => setReadiness(data.readiness || null))
      .catch(() => setReadiness(null))
  }, [chosenBid])

  // Poll for proposal once drafting starts
  useEffect(() => {
    const status = agentStatuses.bid_proposer_agent?.status
    if (!chosenBid) return
    if (status === 'proposal_ready' || status === 'revised_ready') {
      axios.get(`/api/proposals/${encodeURIComponent(chosenBid)}`).then(({ data }) => {
        if (data.proposal) setProposal(data.proposal)
        setHasPdf(data.has_pdf || false)
      }).catch(() => {})
    }
  }, [agentStatuses.bid_proposer_agent?.status, chosenBid])

  const handlePrepare = async () => {
    if (!chosenBid) return
    setProposalLoading(true)
    try {
      const { data } = await axios.post('/api/proposals/prepare', { bid_number: chosenBid })
      if (data.readiness) setReadiness(data.readiness)
      if (data.blocked) addToast({ type: 'error', title: 'Tender Processing Blocked', message: data.readiness?.reasons?.join('; ') || 'The primary tender document is not usable.' })
    } catch (err) {
      console.error('Prepare failed:', err)
      addToast({ type: 'error', title: 'Proposal Failed', message: err.response?.data?.error || 'Could not generate proposal' })
    } finally {
      setProposalLoading(false)
    }
  }

  const handleResubmit = async () => {
    if (!chosenBid || gaps.length === 0) return
    try {
      await axios.post('/api/proposals/revise', { bid_number: chosenBid, gaps })
    } catch (err) {
      console.error('Revise failed:', err)
      addToast({ type: 'error', title: 'Revision Failed', message: err.response?.data?.error || 'Could not submit revision' })
    }
  }

  const proposerStatus = agentStatuses.bid_proposer_agent?.status || 'idle'
  const hasGaps = gaps.length > 0
  const pdfUrl = chosenBid ? `/api/proposals/${encodeURIComponent(chosenBid)}/pdf` : null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-white mb-2">Bid Proposal</h2>
        <p className="text-sm text-slate-400">Generate and refine your proposal with AI assistance</p>
      </div>

      {/* Bid Selector */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={chosenBid}
          onChange={(e) => setChosenBid(e.target.value)}
          className="flex-1 px-4 py-3 bg-card border border-slate-500/30 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
        >
          <option value="">Select a downloaded bid...</option>
          {availableBids.map((b) => (
            <option key={b.bid_number} value={b.bid_number}>{b.bid_number}</option>
          ))}
        </select>
        <button
          onClick={handlePrepare}
          disabled={!chosenBid || proposerStatus === 'drafting'}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-900/30"
        >
          <FileText className="w-4 h-4" />
          {proposerStatus === 'drafting' ? 'Generating...' : 'Prepare Proposal'}
        </button>
      </div>

      {/* Status Bar */}
      {proposerStatus !== 'idle' && (
        <div className="mb-6 p-3.5 bg-agent-proposer/10 border border-agent-proposer/25 rounded-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-agent-proposer animate-pulse-dot" />
          <span className="text-sm text-emerald-300 font-mono">
            Agent 2: {agentStatuses.bid_proposer_agent?.detail || proposerStatus}
          </span>
        </div>
      )}

      {readiness && (
        <div className={`mb-6 p-4 rounded-xl border ${
          readiness.status === 'READY'
            ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-200'
            : readiness.status === 'BLOCKED'
              ? 'bg-red-500/10 border-red-400/30 text-red-200'
              : 'bg-amber-500/10 border-amber-400/30 text-amber-100'
        }`}>
          <div className="text-sm font-semibold">Tender readiness: {readiness.status}</div>
          {readiness.status !== 'READY' && (
            <div className="mt-2 text-xs space-y-1">
              {(readiness.affected_documents || []).map((document) => (
                <div key={document.document_id || document.stored_path}>
                  {document.original_filename || document.stored_path} — {document.extraction_status}
                  {document.error ? `: ${document.error}` : document.warnings?.[0] ? `: ${document.warnings[0]}` : ''}
                </div>
              ))}
              {readiness.status === 'INCOMPLETE' && <div>Any resulting analysis will be marked incomplete and is not submission-ready or approved.</div>}
            </div>
          )}
        </div>
      )}

      {/* Gap Notification Banner */}
      {hasGaps && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">
              {gaps.length} Gap(s) Identified by Assessor
            </h3>
          </div>
          <div className="space-y-2 mb-4">
            {gaps.map((gap, i) => (
              <GapReportCard key={gap.gap_id || i} gap={gap} index={i} />
            ))}
          </div>
          <button
            onClick={handleResubmit}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/15 border border-amber-400/30 rounded-xl text-sm text-amber-300 hover:bg-amber-400/25 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Submit for Re-Review
          </button>
        </motion.div>
      )}

      {/* Proposal Content */}
      {proposal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Generated Proposal</h3>
            <div className="flex items-center gap-2">
              {hasPdf && (
                <>
                  <button
                    onClick={() => setShowPdfViewer(!showPdfViewer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-300 border border-cyan-400/25 rounded-lg hover:bg-cyan-500/10 transition-all"
                  >
                    {showPdfViewer ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showPdfViewer ? 'Show Text' : 'View PDF'}
                  </button>
                  <a
                    href={pdfUrl}
                    download={`ANAMAC_Proposal_${chosenBid}.pdf`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-300 border border-emerald-400/25 rounded-lg hover:bg-emerald-500/10 transition-all"
                  >
                    <Download className="w-3 h-3" /> Download PDF
                  </a>
                </>
              )}
            </div>
          </div>

          {/* PDF or Text view */}
          {showPdfViewer && hasPdf ? (
            <div className="h-[600px]">
              <DocumentViewer url={pdfUrl} title={`Proposal - ${chosenBid}`} />
            </div>
          ) : (
            <div className="bg-card/80 border border-slate-500/15 rounded-xl overflow-hidden">
              <div className="p-6 font-body text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
                {proposal}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Loading shimmer */}
      {proposerStatus === 'drafting' && !proposal && (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-4 bg-card rounded-lg animate-shimmer" style={{ width: `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
      )}
    </div>
  )
}

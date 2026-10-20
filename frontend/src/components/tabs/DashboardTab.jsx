import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, FileText, CheckCircle, Clock, AlertCircle,
  Eye, Package, ChevronDown, ChevronUp, Search, Globe, Trophy, XCircle, Loader
} from 'lucide-react'
import axios from 'axios'
import useBidStore from '../../store/bidStore'

const STATUS_CONFIG = {
  completed:           { label: 'Completed',          color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  assessment_pending:  { label: 'Awaiting Assessment', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  downloaded:          { label: 'Downloaded',          color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30' },
  partial:             { label: 'Partial',             color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30' },
}

const VERDICT_CONFIG = {
  'APPROVED':               { label: 'Approved',               color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-400/40' },
  'CONDITIONALLY APPROVED': { label: 'Conditionally Approved', color: 'text-amber-300',   bg: 'bg-amber-500/15 border-amber-400/40' },
}

const GEM_STATUS_CONFIG = {
  'Open':             { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
  'Closed':           { color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30',     icon: XCircle },
  'Under Evaluation': { color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30',       icon: Clock },
  'Awarded':          { color: 'text-yellow-300',  bg: 'bg-yellow-500/10 border-yellow-500/30',   icon: Trophy },
  'Cancelled':        { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',         icon: XCircle },
  'Check Failed':     { color: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-500/20',     icon: AlertCircle },
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-slate-700/40 rounded-lg p-5 flex items-center gap-4"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white font-display">{value}</p>
        <p className="text-xs text-slate-400 font-ui mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function GemStatusBadge({ gemStatus }) {
  if (!gemStatus) return null
  const cfg = GEM_STATUS_CONFIG[gemStatus] || { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', icon: Globe }
  const Icon = cfg.icon
  return (
    <span className={`shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-ui font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {gemStatus}
    </span>
  )
}

function BidRow({ bid, index, onNavigate, onGemStatusUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [checking, setChecking] = useState(false)
  const [localBid, setLocalBid] = useState(bid)
  const status = STATUS_CONFIG[localBid.status] || STATUS_CONFIG.partial
  const verdict = localBid.verdict ? VERDICT_CONFIG[localBid.verdict] : null
  const safeName = localBid.bid_number.replace(/\//g, '_').replace(/ /g, '_')

  const handleCheckGemStatus = async (e) => {
    e.stopPropagation()
    setChecking(true)
    try {
      const res = await axios.post(`/api/bids/${encodeURIComponent(safeName)}/check-gem-status`)
      setLocalBid(prev => ({
        ...prev,
        gem_status: res.data.gem_status,
        awarded_to: res.data.awarded_to,
        awarded_value: res.data.awarded_value,
        gem_status_checked_at: res.data.checked_at,
      }))
      if (onGemStatusUpdated) onGemStatusUpdated()
    } catch (err) {
      // silently fail — user can retry
    } finally {
      setChecking(false)
    }
  }

  const checkedAt = localBid.gem_status_checked_at
    ? new Date(localBid.gem_status_checked_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="border border-slate-700/40 rounded-lg overflow-hidden bg-card/50"
    >
      {/* Main row */}
      <div className="p-4 flex items-center gap-4">
        {/* Index */}
        <span className="text-slate-600 text-xs font-mono w-5 shrink-0">{index + 1}</span>

        {/* Bid info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 font-mono truncate">{bid.bid_number}</p>
          {bid.title && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{bid.title}</p>
          )}
          {bid.department && (
            <p className="text-xs text-slate-500 truncate">{bid.department}</p>
          )}
        </div>

        {/* Deadline */}
        <div className="hidden md:block text-right shrink-0 w-24">
          <p className="text-xs text-slate-500">Deadline</p>
          <p className="text-xs text-slate-300">{bid.deadline || '—'}</p>
        </div>

        {/* Processed date */}
        <div className="hidden lg:block text-right shrink-0 w-28">
          <p className="text-xs text-slate-500">Processed</p>
          <p className="text-xs text-slate-300">{formatDate(bid.processed_at)}</p>
        </div>

        {/* Internal status badge */}
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-ui font-medium ${status.bg} ${status.color}`}>
          {status.label}
        </span>

        {/* Verdict badge */}
        {verdict && (
          <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-ui font-medium ${verdict.bg} ${verdict.color}`}>
            {verdict.label}
          </span>
        )}

        {/* GEM live status badge */}
        <GemStatusBadge gemStatus={localBid.gem_status} />

        {/* Check GEM status button */}
        <button
          onClick={handleCheckGemStatus}
          disabled={checking}
          title="Check live status on GEM portal"
          className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
        >
          {checking ? <Loader className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
          {checking ? 'Checking…' : 'GEM'}
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-slate-700/40 px-4 py-3 bg-elevated/40 space-y-3"
        >
          {/* Award info (shown when awarded) */}
          {localBid.gem_status === 'Awarded' && (localBid.awarded_to || localBid.awarded_value) && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/8 border border-yellow-500/25">
              <Trophy className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-yellow-300 mb-0.5">Bid Awarded</p>
                {localBid.awarded_to && (
                  <p className="text-xs text-slate-300">Awarded to: <span className="text-yellow-200 font-medium">{localBid.awarded_to}</span></p>
                )}
                {localBid.awarded_value && (
                  <p className="text-xs text-slate-300 mt-0.5">Value: <span className="text-yellow-200 font-medium">{localBid.awarded_value}</span></p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            {/* File indicators */}
            <div className="flex gap-3 mr-auto flex-wrap">
              <span className={`text-xs flex items-center gap-1 ${localBid.has_document ? 'text-emerald-400' : 'text-slate-600'}`}>
                <FileText className="w-3.5 h-3.5" /> Bid Doc
              </span>
              <span className={`text-xs flex items-center gap-1 ${localBid.has_proposal ? 'text-emerald-400' : 'text-slate-600'}`}>
                <FileText className="w-3.5 h-3.5" /> Proposal
              </span>
              <span className={`text-xs flex items-center gap-1 ${localBid.has_summary ? 'text-emerald-400' : 'text-slate-600'}`}>
                <CheckCircle className="w-3.5 h-3.5" /> Assessment
              </span>
              {localBid.supporting_docs_count > 0 && (
                <span className="text-xs text-slate-400">{localBid.supporting_docs_count} supporting docs</span>
              )}
              {checkedAt && (
                <span className="text-xs text-slate-600">GEM checked: {checkedAt}</span>
              )}
            </div>

            {/* Action buttons */}
            {localBid.has_document && (
              <a
                href={`/api/bids/${encodeURIComponent(safeName)}/document`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> View Bid
              </a>
            )}
            {localBid.has_proposal && (
              <a
                href={`/api/bids/${encodeURIComponent(safeName)}/proposal`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> View Proposal
              </a>
            )}
            {localBid.has_summary && (
              <button
                onClick={() => onNavigate(localBid.bid_number)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> View Summary
              </button>
            )}
            <a
              href={`/api/bids/${encodeURIComponent(safeName)}/package`}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-slate-500/10 border border-slate-500/30 text-slate-300 hover:bg-slate-500/20 transition-colors"
            >
              <Package className="w-3.5 h-3.5" /> Download Package
            </a>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function DashboardTab() {
  const { bidHistory, historyLoading, setBidHistory, setHistoryLoading, setActiveTab, setSelectedBid, addToast } = useBidStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await axios.get('/api/bids/history')
      setBidHistory(res.data.bids || [])
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to load bid history' })
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { fetchHistory() }, [])

  const handleNavigateToSummary = (bidNumber) => {
    setSelectedBid({ bid_number: bidNumber })
    setActiveTab('summary')
  }

  // Stats
  const total = bidHistory.length
  const completed = bidHistory.filter(b => b.status === 'completed').length
  const inProgress = bidHistory.filter(b => ['downloaded', 'assessment_pending'].includes(b.status)).length
  const approved = bidHistory.filter(b => b.verdict === 'APPROVED').length

  // Filtered list
  const filtered = bidHistory.filter(b => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'completed' && b.status === 'completed') ||
      (filter === 'in_progress' && ['downloaded', 'assessment_pending'].includes(b.status)) ||
      (filter === 'approved' && b.verdict === 'APPROVED')
    const matchesSearch =
      !search ||
      b.bid_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.department || '').toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white font-display">Bid History</h2>
          <p className="text-sm text-slate-400 mt-0.5">All processed bids and their current status</p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={historyLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-slate-700/40 text-slate-300 hover:text-white hover:border-cyan-500/40 transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}     label="Total Bids"    value={total}      color="bg-blue-500/20 text-blue-400" />
        <StatCard icon={CheckCircle}  label="Completed"     value={completed}  color="bg-emerald-500/20 text-emerald-400" />
        <StatCard icon={Clock}        label="In Progress"   value={inProgress} color="bg-amber-500/20 text-amber-400" />
        <StatCard icon={AlertCircle}  label="Approved"      value={approved}   color="bg-cyan-500/20 text-cyan-400" />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by bid number, title, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-slate-700/40 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'all',         label: 'All' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed',   label: 'Completed' },
            { id: 'approved',    label: 'Approved' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-lg text-sm font-ui transition-all border ${
                filter === f.id
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-card border-slate-700/40 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bid list */}
      {historyLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-card/50 border border-slate-700/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{bidHistory.length === 0 ? 'No bids processed yet. Use the Search tab to find and download bids.' : 'No bids match your filter.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bid, i) => (
            <BidRow key={bid.bid_number} bid={bid} index={i} onNavigate={handleNavigateToSummary} onGemStatusUpdated={fetchHistory} />
          ))}
        </div>
      )}
    </div>
  )
}

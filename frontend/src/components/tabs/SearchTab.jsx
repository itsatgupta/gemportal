import { useState } from 'react'
import { Search, Download, Clock, Building2, IndianRupee, Package, CalendarCheck, CheckCircle2, Loader2, AlertCircle, FileDown, RotateCcw, Brain, FileText, Zap, BarChart3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import useBidStore from '../../store/bidStore'
import FolderTree from '../shared/FolderTree'

const QUICK_CHIPS = ['QRA', 'HAZOP', 'Fire Safety', 'Environmental', 'Safety Audit']

export default function SearchTab() {
  const [query, setQuery] = useState('')
  const {
    searchResults, setSearchResults, searchLoading, setSearchLoading,
    setSelectedBid, setActiveTab, agentStatuses, downloadProgress, addToast,
    scopeAnalysis,
  } = useBidStore()

  const handleSearch = async (q) => {
    const searchQuery = q || query
    if (!searchQuery.trim()) return

    setSearchLoading(true)
    try {
      const { data } = await axios.post('/api/bids/search', { query: searchQuery, max_results: 20 })
      setSearchResults(data.bids || [])
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults([])
      addToast({ type: 'error', title: 'Search Failed', message: err.response?.data?.error || 'Could not reach the server' })
    } finally {
      setSearchLoading(false)
    }
  }

  const handleDownload = async (bid) => {
    try {
      await axios.post('/api/bids/download', {
        bid_number: bid.bid_number,
        detail_url: bid.detail_url,
        value: bid.value || '',
        quantity: bid.quantity || '',
        items: bid.items || '',
        title: bid.title || '',
        department: bid.department || '',
        deadline: bid.deadline || '',
      })
      setSelectedBid(bid)
    } catch (err) {
      console.error('Download failed:', err)
      addToast({ type: 'error', title: 'Download Failed', message: err.response?.data?.error || 'Failed to start download' })
    }
  }

  const searchStatus = agentStatuses.search_agent?.status || 'idle'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Search Header */}
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-white mb-2">Discover Open Bids</h2>
        <p className="text-sm text-slate-400">Search the GEM Portal for open government bids matching your expertise</p>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400/60" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter bid type (e.g. QRA, HAZOP, Safety Audit...)"
          className="w-full pl-12 pr-40 py-4 bg-card border border-slate-500/30 rounded-xl text-slate-100 placeholder-slate-500 font-body text-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
        />
        <button
          onClick={() => handleSearch()}
          disabled={searchLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 transition-all disabled:opacity-50 shadow-md shadow-cyan-900/30"
        >
          {searchLoading ? 'Searching...' : 'Search Bids'}
        </button>
      </div>

      {/* Quick Chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => { setQuery(chip); handleSearch(chip) }}
            className="px-4 py-1.5 bg-card border border-slate-500/20 rounded-full text-sm text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300 hover:bg-elevated/50 transition-all"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Agent Status */}
      {searchStatus !== 'idle' && (
        <div className="mb-6 p-3 bg-agent-search/10 border border-agent-search/25 rounded-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-agent-search animate-pulse-dot" />
          <span className="text-sm text-blue-300 font-mono">
            Agent 1: {agentStatuses.search_agent?.detail || searchStatus}
          </span>
        </div>
      )}

      {/* Download Progress Panel */}
      {Object.entries(downloadProgress).map(([bidNum, prog]) => prog && prog.status !== 'idle' && (
        <motion.div
          key={bidNum}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-card/80 border border-cyan-400/20 rounded-xl"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileDown className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">Downloading: {bidNum}</span>
            {prog.status === 'complete' && prog.phase === 'all' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
            )}
            {prog.status === 'downloading' && (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin ml-auto" />
            )}
            {prog.status === 'error' && (
              <AlertCircle className="w-4 h-4 text-red-400 ml-auto" />
            )}
          </div>

          {/* Primary PDF */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Primary Bid Document</span>
              <span>{prog.phase === 'primary' && prog.status === 'complete' ? 'Done' : prog.phase === 'primary' ? 'Downloading...' : prog.completed > 0 || prog.phase !== 'primary' ? 'Done' : ''}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${prog.status === 'error' && prog.phase === 'primary' ? 'bg-red-400' : 'bg-cyan-400'}`}
                style={{ width: prog.phase === 'primary' && prog.status === 'downloading' ? '50%' : (prog.phase !== 'primary' || prog.status === 'complete') ? '100%' : '0%' }}
              />
            </div>
          </div>

          {/* Supporting docs */}
          {(prog.phase === 'supporting' || prog.phase === 'all') && prog.total > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Supporting Documents ({prog.completed}/{prog.total})</span>
                {prog.currentFile && prog.status === 'downloading' && (
                  <span className="text-cyan-300/60 font-mono truncate max-w-[200px]">{prog.currentFile}</span>
                )}
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${prog.total > 0 ? (prog.completed / prog.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {prog.phase === 'all' && prog.status === 'complete' && (
            <p className="text-xs text-emerald-400 mt-2">All documents downloaded successfully</p>
          )}
          {prog.status === 'error' && (
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-red-400 flex-1">Download encountered an error</p>
              <button
                onClick={() => {
                  const bid = searchResults.find((b) => b.bid_number === bidNum)
                  if (bid) handleDownload(bid)
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-400/10 border border-red-400/25 rounded-md text-xs text-red-300 hover:bg-red-400/20 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}
        </motion.div>
      ))}

      {/* Folder Tree Preview — shown after download completes */}
      {Object.entries(downloadProgress).map(([bidNum, prog]) =>
        prog && prog.phase === 'all' && prog.status === 'complete' ? (
          <div key={`tree-${bidNum}`} className="mb-6">
            <FolderTree bidNumber={bidNum} />
          </div>
        ) : null
      )}

      {/* Scope Intelligence Brief Panel */}
      <AnimatePresence>
        {Object.entries(downloadProgress).map(([bidNum, prog]) => {
          if (!prog || !(prog.phase === 'all' && prog.status === 'complete')) return null
          const scope = scopeAnalysis[bidNum]
          if (!scope) return null

          const complexityColors = {
            Low: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
            Medium: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
            High: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
            'Very High': 'text-red-400 border-red-400/30 bg-red-400/10',
          }
          const compClass = complexityColors[scope.complexity] || complexityColors.Medium

          return (
            <motion.div
              key={`scope-${bidNum}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-5 bg-card border border-amber-400/25 rounded-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center">
                    {scope.status === 'analyzing' ? (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : scope.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Brain className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-300">Scope Intelligence Brief</h3>
                    <p className="text-xs text-slate-400 font-mono">{bidNum}</p>
                  </div>
                </div>
                {scope.status === 'complete' && (
                  <a
                    href={`/api/bids/${encodeURIComponent(bidNum.replace(/[/\s]/g, '_'))}/scope-summary`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 rounded-lg text-xs text-amber-300 hover:bg-amber-400/20 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View PDF
                  </a>
                )}
              </div>

              {scope.status === 'analyzing' && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="font-mono">{scope.detail || 'Analyzing bid documents with AI...'}</span>
                </div>
              )}

              {scope.status === 'error' && (
                <p className="text-sm text-red-400">{scope.error || 'Scope analysis encountered an error'}</p>
              )}

              {scope.status === 'complete' && (
                <>
                  {/* Study type + complexity */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {scope.study_type && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-400/10 border border-cyan-400/25 rounded-md text-xs text-cyan-300 font-medium">
                        <Zap className="w-3 h-3" />
                        {scope.study_type}
                      </span>
                    )}
                    {scope.complexity && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 border rounded-md text-xs font-medium ${compClass}`}>
                        <BarChart3 className="w-3 h-3" />
                        {scope.complexity} Complexity
                      </span>
                    )}
                    {scope.has_price_estimate && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400/10 border border-emerald-400/25 rounded-md text-xs text-emerald-300 font-medium">
                        <IndianRupee className="w-3 h-3" />
                        Price Estimate Found
                      </span>
                    )}
                  </div>

                  {/* Key metrics grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {scope.pid_count != null && (
                      <div className="p-3 bg-elevated rounded-lg border border-amber-400/20">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">P&ID Drawings</p>
                        <p className="text-2xl font-bold text-amber-300 font-mono">{scope.pid_count}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">HAZOP key metric</p>
                      </div>
                    )}
                    {scope.site_area_ha != null && (
                      <div className="p-3 bg-elevated rounded-lg border border-cyan-400/20">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Site Area</p>
                        <p className="text-2xl font-bold text-cyan-300 font-mono">{scope.site_area_ha} ha</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">QRA coverage</p>
                      </div>
                    )}
                    {scope.pipeline_km != null && (
                      <div className="p-3 bg-elevated rounded-lg border border-teal-400/20">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Pipeline</p>
                        <p className="text-2xl font-bold text-teal-300 font-mono">{scope.pipeline_km} km</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">QRA key metric</p>
                      </div>
                    )}
                    {scope.pid_count == null && scope.site_area_ha == null && scope.pipeline_km == null && (
                      <div className="col-span-3 text-sm text-slate-400 font-mono">
                        Detailed metrics in the PDF report
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {searchResults.length} Open Bids Found
            </h3>
            {searchResults.map((bid, i) => (
              <motion.div
                key={bid.bid_number || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 bg-card/80 border border-slate-500/15 rounded-xl hover:border-cyan-400/30 hover:bg-elevated/60 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="font-mono text-sm text-cyan-300 font-medium">{bid.bid_number}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 uppercase tracking-wider">
                        Open
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-slate-100 mb-2.5 line-clamp-2">{bid.title || bid.items}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                      {bid.department && (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" /> {bid.department}
                        </span>
                      )}
                      {bid.deadline && (
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <Clock className="w-3.5 h-3.5" /> Ends: {bid.deadline}
                        </span>
                      )}
                      {bid.start_date && (
                        <span className="flex items-center gap-1.5 text-emerald-400/80">
                          <CalendarCheck className="w-3.5 h-3.5" /> Started: {bid.start_date}
                        </span>
                      )}
                      {bid.quantity && (
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-500" /> Qty: {bid.quantity}
                        </span>
                      )}
                      {bid.value && (
                        <span className="flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5 text-slate-500" /> {bid.value}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {bid.detail_url && (
                      <a
                        href={bid.detail_url.startsWith('http') ? bid.detail_url : `https://bidplus.gem.gov.in${bid.detail_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-500/10 border border-slate-400/25 rounded-lg text-sm text-slate-300 hover:bg-slate-500/20 hover:border-slate-400/40 transition-all"
                      >
                        <Search className="w-4 h-4" />
                        View on GEM
                      </a>
                    )}
                    <button
                      onClick={() => handleDownload(bid)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-400/25 rounded-lg text-sm text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/40 transition-all group-hover:shadow-sm group-hover:shadow-cyan-900/20"
                    >
                      <Download className="w-4 h-4" />
                      Select & Download
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

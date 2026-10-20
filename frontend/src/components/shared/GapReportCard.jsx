import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import StatusBadge from './StatusBadge'

const SEVERITY_ICON = {
  Critical: AlertTriangle,
  Major: AlertCircle,
  Minor: Info,
}

const SEVERITY_STYLES = {
  Critical: { bg: 'bg-red-500/10', border: 'border-red-400/25', icon: 'text-red-400' },
  Major: { bg: 'bg-orange-500/10', border: 'border-orange-400/25', icon: 'text-orange-400' },
  Minor: { bg: 'bg-yellow-500/10', border: 'border-yellow-400/25', icon: 'text-yellow-400' },
}

export default function GapReportCard({ gap, index = 0, onResolve }) {
  const severity = gap.severity || 'Minor'
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.Minor
  const Icon = SEVERITY_ICON[severity] || Info
  const isResolved = gap.status === 'resolved'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`p-4 rounded-xl border ${isResolved ? 'bg-emerald-500/5 border-emerald-400/15' : `${style.bg} ${style.border}`} transition-all`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isResolved ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : (
            <Icon className={`w-5 h-5 ${style.icon}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-slate-500">{gap.gap_id}</span>
            <StatusBadge type={severity} label={severity} />
            {isResolved && <StatusBadge type="resolved" label="Resolved" />}
          </div>
          <h4 className="text-sm font-medium text-slate-200 mb-1">{gap.section}</h4>
          <p className="text-xs text-slate-400 mb-2">{gap.description}</p>
          {gap.recommendation && (
            <div className="text-xs text-slate-500 bg-card/40 rounded-lg p-2 border border-slate-600/10">
              <span className="font-semibold text-slate-400">Recommendation:</span> {gap.recommendation}
            </div>
          )}
        </div>
        {onResolve && !isResolved && (
          <button
            onClick={() => onResolve(gap.gap_id)}
            className="px-3 py-1.5 text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/20 transition-colors flex-shrink-0"
          >
            Mark Resolved
          </button>
        )}
      </div>
    </motion.div>
  )
}

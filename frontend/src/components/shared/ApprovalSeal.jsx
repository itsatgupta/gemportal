import { motion } from 'framer-motion'
import { Shield, CheckCircle, AlertCircle } from 'lucide-react'

export default function ApprovalSeal({ verdict, timestamp }) {
  if (!verdict) return null

  const isApproved = verdict === 'APPROVED'
  const color = isApproved ? 'emerald' : 'yellow'
  const Icon = isApproved ? CheckCircle : AlertCircle
  const dateStr = timestamp ? new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 12, delay: 0.2 }}
      className="inline-flex flex-col items-center"
    >
      {/* Outer ring */}
      <div className={`relative p-2 rounded-full border-[3px] border-dashed border-${color}-400/40`}>
        {/* Inner circle */}
        <motion.div
          initial={{ rotate: -180 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', stiffness: 80, delay: 0.4 }}
          className={`w-32 h-32 rounded-full bg-${color}-500/10 border-2 border-${color}-400/50 flex flex-col items-center justify-center`}
        >
          <Icon className={`w-10 h-10 text-${color}-400 mb-1`} />
          <span className={`text-xs font-bold text-${color}-300 uppercase tracking-wider`}>
            {verdict}
          </span>
        </motion.div>
      </div>

      {/* Shield badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={`-mt-3 px-3 py-1 rounded-full bg-${color}-400/20 border border-${color}-400/30 flex items-center gap-1.5`}
      >
        <Shield className={`w-3 h-3 text-${color}-400`} />
        <span className={`text-[10px] font-semibold text-${color}-300 uppercase`}>ANAMAC Certified</span>
      </motion.div>

      {/* Date */}
      <p className="text-[10px] text-slate-500 mt-2">{dateStr}</p>
    </motion.div>
  )
}

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import useBidStore from '../../store/bidStore'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  error: 'border-red-400/40 bg-red-400/10 text-red-300',
  warning: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  info: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useBidStore()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || Info
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={`flex items-start gap-3 p-3 rounded-lg border backdrop-blur-sm ${COLORS[toast.type]}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="text-xs font-semibold mb-0.5">{toast.title}</p>
                )}
                <p className="text-xs opacity-90">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-0.5 rounded hover:bg-white/10 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

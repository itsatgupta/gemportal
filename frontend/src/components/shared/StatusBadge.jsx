const SEVERITY_STYLES = {
  Critical: 'bg-red-400/15 text-red-300 border-red-400/25',
  Major: 'bg-orange-400/15 text-orange-300 border-orange-400/25',
  Minor: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/25',
  open: 'bg-slate-400/15 text-slate-300 border-slate-400/25',
  resolved: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
}

export default function StatusBadge({ label, type = 'open' }) {
  const style = SEVERITY_STYLES[type] || SEVERITY_STYLES.open

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${style}`}>
      {label || type}
    </span>
  )
}

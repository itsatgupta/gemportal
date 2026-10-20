import useBidStore from '../../store/bidStore'

export default function AgentStatusBar() {
  const { agentStatuses } = useBidStore()
  const working = Object.entries(agentStatuses).filter(([, v]) => v.status !== 'idle')

  if (working.length === 0) return null

  return (
    <div className="h-9 bg-card/80 border-t border-cyan-500/10 flex items-center px-4 gap-6 backdrop-blur-sm">
      {working.map(([name, { status, detail }]) => (
        <div key={name} className="flex items-center gap-2 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-dot" />
          <span className="text-cyan-300 font-mono font-medium">{name.replace('_agent', '')}</span>
          <span className="text-slate-400">{status}</span>
          {detail && <span className="text-slate-500 truncate max-w-xs">| {detail}</span>}
        </div>
      ))}
    </div>
  )
}

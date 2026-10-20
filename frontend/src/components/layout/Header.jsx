import useBidStore from '../../store/bidStore'

export default function Header() {
  const wsConnected = useBidStore((s) => s.wsConnected)

  return (
    <header className="h-16 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-cyan-400/30 flex items-center justify-between px-6 shadow-lg shadow-cyan-900/10">
      <div className="flex items-center gap-3">
        <img src="/anamaclogo.png" alt="ANAMAC" className="w-10 h-10 object-contain" />
        <div>
          <h1 className="font-display text-xl font-bold text-white tracking-wide">ANAMAC</h1>
          <p className="text-[11px] text-cyan-300/70 font-ui -mt-0.5">Bid Intelligence Platform</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-400 font-mono">v1.0.0</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-red-400'}`} />
          <span className={`text-[11px] ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            {wsConnected ? 'Online' : 'Reconnecting...'}
          </span>
        </div>
      </div>
    </header>
  )
}

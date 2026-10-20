import { useState } from 'react'
import { FileText, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'

export default function DocumentViewer({ url, title = 'Document', onClose }) {
  const [zoom, setZoom] = useState(100)

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500">
        <FileText className="w-12 h-12 mb-3 text-slate-600" />
        <p className="text-sm">No document selected</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-card/80 border border-slate-500/15 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-600/20 bg-elevated/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="p-1.5 rounded-md hover:bg-card text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 w-10 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="p-1.5 rounded-md hover:bg-card text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-600/30 mx-1" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-card text-slate-400 hover:text-slate-200 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={url}
            download
            className="p-1.5 rounded-md hover:bg-card text-slate-400 hover:text-slate-200 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* PDF embed via iframe — works reliably across browsers */}
      <div className="flex-1 overflow-auto bg-slate-900/50">
        <iframe
          src={`${url}#toolbar=0&view=FitH`}
          title={title}
          className="w-full h-full border-0"
          style={{ minHeight: '500px', transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%`, height: `${10000 / zoom}%` }}
        />
      </div>
    </div>
  )
}

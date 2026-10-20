import { useState, useEffect } from 'react'
import { Folder, FolderOpen, FileText, File, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const FILE_ICONS = {
  PDF: '📄',
  TXT: '📝',
  DOCX: '📋',
  DOC: '📋',
  ZIP: '📦',
}

function FileNode({ file, index }) {
  const icon = FILE_ICONS[file.type] || '📎'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-2 py-1 pl-6 text-xs group hover:bg-white/[0.03] rounded"
    >
      <span className="text-sm">{icon}</span>
      <span className="text-slate-300 truncate flex-1 font-mono" title={file.name}>
        {file.name}
      </span>
      <span className="text-slate-500 text-[10px] font-mono flex-shrink-0">
        {file.size_display}
      </span>
      <span className="text-slate-600 text-[10px] uppercase flex-shrink-0 w-8 text-right">
        {file.type}
      </span>
    </motion.div>
  )
}

function FolderNode({ name, files, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const Icon = open ? FolderOpen : Folder

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-1.5 text-xs w-full hover:bg-white/[0.03] rounded transition-colors"
      >
        <Icon className="w-4 h-4 text-cyan-400/80 flex-shrink-0" />
        <span className="text-cyan-300 font-mono font-medium">{name}/</span>
        <span className="text-slate-600 text-[10px]">({files.length})</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-l border-slate-700/50 ml-2"
          >
            {files.map((f, i) => (
              <FileNode key={f.path} file={f} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FolderTree({ bidNumber }) {
  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchTree = async () => {
    if (!bidNumber) return
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/bids/${encodeURIComponent(bidNumber)}/tree`)
      setTree(data)
    } catch {
      setTree(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTree()
  }, [bidNumber])

  if (!bidNumber) return null
  if (loading) {
    return (
      <div className="p-3 bg-card/60 border border-slate-700/30 rounded-lg">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Loading folder structure...
        </div>
      </div>
    )
  }
  if (!tree || tree.tree.length === 0) return null

  // Group files by folder
  const rootFiles = []
  const folders = {}
  for (const f of tree.tree) {
    const parts = f.path.split('/')
    if (parts.length > 1) {
      const folder = parts[0]
      if (!folders[folder]) folders[folder] = []
      folders[folder].push(f)
    } else {
      rootFiles.push(f)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-card/60 border border-cyan-400/10 rounded-lg"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-cyan-300 font-semibold">
            bids/{bidNumber.replace(/\//g, '_').replace(/ /g, '_')}/
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            {tree.tree.length} files · {tree.total_display}
          </span>
          <button
            onClick={fetchTree}
            className="p-1 rounded hover:bg-white/[0.05] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3 text-slate-500 hover:text-cyan-400" />
          </button>
        </div>
      </div>
      <div className="space-y-0.5">
        {rootFiles.map((f, i) => (
          <FileNode key={f.path} file={f} index={i} />
        ))}
        {Object.entries(folders).map(([folder, files]) => (
          <FolderNode key={folder} name={folder} files={files} />
        ))}
      </div>
    </motion.div>
  )
}

import { create } from 'zustand'

const useBidStore = create((set, get) => ({
  // Active tab
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Search results
  searchResults: [],
  searchLoading: false,
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),

  // Selected bid
  selectedBid: null,
  setSelectedBid: (bid) => set({ selectedBid: bid }),

  // Agent statuses
  agentStatuses: {
    search_agent: { status: 'idle', detail: '' },
    bid_proposer_agent: { status: 'idle', detail: '' },
    bid_assessor_agent: { status: 'idle', detail: '' },
    qa_agent: { status: 'idle', detail: '' },
  },
  updateAgentStatus: (agent, status, detail) =>
    set((state) => ({
      agentStatuses: {
        ...state.agentStatuses,
        [agent]: { status, detail },
      },
    })),

  // Agent messages (communication feed)
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),

  // Proposal state
  proposal: null,
  proposalLoading: false,
  setProposal: (p) => set({ proposal: p }),
  setProposalLoading: (l) => set({ proposalLoading: l }),

  // Assessment state
  gaps: [],
  summary: null,
  verdict: null,
  setGaps: (g) => set({ gaps: g }),
  setSummary: (s) => set({ summary: s }),
  setVerdict: (v) => set({ verdict: v }),

  // Download state
  downloadProgress: {},
  setDownloadProgress: (bidNumber, progress) =>
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [bidNumber]: progress },
    })),

  // Bid history (dashboard)
  bidHistory: [],
  historyLoading: false,
  setBidHistory: (history) => set({ bidHistory: history }),
  setHistoryLoading: (loading) => set({ historyLoading: loading }),

  // Scope analysis state (per bid)
  scopeAnalysis: {},
  setScopeAnalysis: (bidNumber, data) =>
    set((state) => ({
      scopeAnalysis: { ...state.scopeAnalysis, [bidNumber]: data },
    })),

  // WebSocket connection state
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  // Toast notifications
  toasts: [],
  addToast: (toast) => {
    const id = Date.now() + Math.random()
    const newToast = { id, type: 'info', ...toast }
    set((state) => ({ toasts: [...state.toasts, newToast] }))
    // Auto-remove after duration
    const duration = toast.duration || 5000
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export default useBidStore

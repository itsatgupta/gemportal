import { useEffect, useRef } from 'react'
import useBidStore from '../store/bidStore'

export default function useAgentSocket() {
  const wsRef = useRef(null)
  const {
    updateAgentStatus, addMessage, setGaps, setVerdict,
    setDownloadProgress, setWsConnected, addToast, setScopeAnalysis,
  } = useBidStore()

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let reconnectAttempts = 0

    function connect() {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected')
        setWsConnected(true)
        if (reconnectAttempts > 0) {
          addToast({ type: 'success', message: 'Reconnected to server' })
        }
        reconnectAttempts = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'agent_status') {
            updateAgentStatus(data.agent, data.status, data.detail || '')
            // Toast on agent errors
            if (data.status === 'error') {
              addToast({
                type: 'error',
                title: `Agent Error: ${data.agent}`,
                message: data.detail || 'An error occurred',
                duration: 8000,
              })
            }
          } else if (data.type === 'download_progress') {
            setDownloadProgress(data.bid_number, {
              phase: data.phase,
              status: data.status,
              completed: data.completed,
              total: data.total,
              currentFile: data.current_file || '',
            })
            // Toast on download errors
            if (data.status === 'error') {
              addToast({
                type: 'error',
                title: 'Download Failed',
                message: `Failed to download file for ${data.bid_number}`,
              })
            }
            // Toast on download complete
            if (data.phase === 'all' && data.status === 'complete') {
              addToast({
                type: 'success',
                title: 'Download Complete',
                message: `All documents for ${data.bid_number} downloaded`,
              })
            }
          } else if (data.type === 'scope_analysis') {
            setScopeAnalysis(data.bid_number, {
              status: data.status,
              detail: data.detail || '',
              study_type: data.study_type || '',
              complexity: data.complexity || '',
              has_price_estimate: data.has_price_estimate || false,
              pid_count: data.pid_count ?? null,
              site_area_ha: data.site_area_ha ?? null,
              pipeline_km: data.pipeline_km ?? null,
              error: data.error || null,
            })
            if (data.status === 'complete') {
              addToast({
                type: 'info',
                title: 'Scope Intelligence Brief Ready',
                message: `${data.study_type || 'Study'} scope analyzed for ${data.bid_number}`,
                duration: 7000,
              })
            } else if (data.status === 'error') {
              addToast({
                type: 'warning',
                title: 'Scope Analysis Issue',
                message: data.error || 'Could not analyze scope',
                duration: 6000,
              })
            }
          } else if (data.message_type) {
            // Agent-to-agent message
            addMessage(data)

            if (data.message_type === 'gap_report') {
              setGaps(data.payload?.gaps || [])
              addToast({
                type: 'warning',
                title: 'Gap Report Received',
                message: `${(data.payload?.gaps || []).length} gaps identified by assessor`,
              })
            } else if (data.message_type === 'approval') {
              setVerdict(data.payload?.verdict || 'APPROVED')
              addToast({
                type: 'success',
                title: 'Bid Assessment Complete',
                message: `Verdict: ${data.payload?.verdict || 'APPROVED'}`,
                duration: 10000,
              })
            } else if (data.message_type === 'error') {
              addToast({
                type: 'error',
                title: 'Agent Error',
                message: data.payload?.message || 'An error occurred',
                duration: 8000,
              })
            }
          }
        } catch (e) {
          console.warn('[WS] Parse error:', e)
        }
      }

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting...')
        setWsConnected(false)
        reconnectAttempts++
        const delay = Math.min(3000 * reconnectAttempts, 15000)
        if (reconnectAttempts === 1) {
          addToast({ type: 'warning', message: 'Connection lost. Reconnecting...' })
        }
        setTimeout(connect, delay)
      }

      ws.onerror = (err) => {
        console.error('[WS] Error:', err)
        ws.close()
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])
}

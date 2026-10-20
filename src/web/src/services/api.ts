const API_BASE = '/api';

export interface SearchParams {
  searchText: string;
  searchType?: 'fullText' | 'exact';
  bidTypes?: string[];
  highValueOnly?: boolean;
  page?: number;
}

export interface BidResult {
  bidId: string;
  bidNumber: string;
  title: string;
  department: string;
  items: string[];
  quantity?: string;
  startDate: string;
  endDate: string;
  bidType: string;
  estimatedValue?: string;
  detailUrl: string;
}

export interface AgentEvent {
  agent: string;
  type: string;
  message: string;
  progress?: number;
}

export async function searchBids(params: SearchParams) {
  const res = await fetch(`${API_BASE}/bids/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error ?? `Search failed: ${res.statusText}`);
  }
  return res.json();
}

export async function downloadBidDocuments(bidId: string) {
  const res = await fetch(`${API_BASE}/bids/${bidId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  return res.json();
}

export async function generateProposal(bidId: string) {
  const res = await fetch(`${API_BASE}/bids/${bidId}/proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Proposal generation failed: ${res.statusText}`);
  return res.json();
}

export async function assessProposal(bidId: string) {
  const res = await fetch(`${API_BASE}/bids/${bidId}/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Assessment failed: ${res.statusText}`);
  return res.json();
}

export async function runPipeline(bidId: string) {
  const res = await fetch(`${API_BASE}/bids/${bidId}/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Pipeline failed: ${res.statusText}`);
  return res.json();
}

export function subscribeToEvents(
  bidId: string,
  onEvent: (event: AgentEvent) => void,
): () => void {
  const eventSource = new EventSource(`${API_BASE}/events/${bidId}`);

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as AgentEvent;
      onEvent(event);
    } catch {
      // Ignore parse errors
    }
  };

  eventSource.onerror = () => {
    // EventSource auto-reconnects
  };

  return () => eventSource.close();
}
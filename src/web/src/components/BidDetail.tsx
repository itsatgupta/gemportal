import React, { useState, useEffect } from 'react';
import type { BidResult, AgentEvent } from '../services/api.js';
import {
  downloadBidDocuments,
  generateProposal,
  assessProposal,
  runPipeline,
  subscribeToEvents,
} from '../services/api.js';
import PipelineStatus from './PipelineStatus.js';

interface Props {
  bid: BidResult;
  onBack: () => void;
}

type ActionStatus = 'idle' | 'running' | 'success' | 'error';

export default function BidDetail({ bid, onBack }: Props) {
  const [downloadStatus, setDownloadStatus] = useState<ActionStatus>('idle');
  const [proposalStatus, setProposalStatus] = useState<ActionStatus>('idle');
  const [assessStatus, setAssessStatus] = useState<ActionStatus>('idle');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const unsub = subscribeToEvents(bid.bidId, (event) => {
      setEvents((prev) => [...prev, event]);
    });
    return unsub;
  }, [bid.bidId]);

  const handleDownload = async () => {
    setDownloadStatus('running');
    setError('');
    try {
      const res = await downloadBidDocuments(bid.bidId);
      setDownloadStatus('success');
      setResult(res);
    } catch (err) {
      setDownloadStatus('error');
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleProposal = async () => {
    setProposalStatus('running');
    setError('');
    try {
      const res = await generateProposal(bid.bidId);
      setProposalStatus('success');
      setResult(res);
    } catch (err) {
      setProposalStatus('error');
      setError(err instanceof Error ? err.message : 'Proposal generation failed');
    }
  };

  const handleAssess = async () => {
    setAssessStatus('running');
    setError('');
    try {
      const res = await assessProposal(bid.bidId);
      setAssessStatus('success');
      setResult(res);
    } catch (err) {
      setAssessStatus('error');
      setError(err instanceof Error ? err.message : 'Assessment failed');
    }
  };

  const handleFullPipeline = async () => {
    setDownloadStatus('running');
    setProposalStatus('idle');
    setAssessStatus('idle');
    setError('');
    try {
      await runPipeline(bid.bidId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline failed');
    }
  };

  const statusColor = (status: ActionStatus) => {
    switch (status) {
      case 'running': return 'text-amber-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-slate-400';
    }
  };

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-indigo-600 hover:text-indigo-800 font-medium mb-4 flex items-center gap-1"
      >
        &larr; Back to results
      </button>

      {/* Bid Info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase">
            {bid.bidType}
          </span>
          <span className="text-sm font-mono text-slate-500">
            Bid #{bid.bidNumber || bid.bidId}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">{bid.title}</h2>
        <p className="text-slate-600">{bid.department}</p>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Start Date</span>
            <p className="font-medium">{bid.startDate || 'N/A'}</p>
          </div>
          <div>
            <span className="text-slate-500">End Date</span>
            <p className="font-medium">{bid.endDate || 'N/A'}</p>
          </div>
          <div>
            <span className="text-slate-500">Quantity</span>
            <p className="font-medium">{bid.quantity || 'N/A'}</p>
          </div>
          <div>
            <span className="text-slate-500">Estimated Value</span>
            <p className="font-medium text-green-700">
              {bid.estimatedValue || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleDownload}
            disabled={downloadStatus === 'running'}
            className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium text-blue-800">Download Documents</p>
              <p className="text-xs text-blue-600">Fetch all bid documents from GEM portal</p>
            </div>
            <span className={`text-sm font-medium ${statusColor(downloadStatus)}`}>
              {downloadStatus === 'running' ? 'Downloading...' : downloadStatus === 'success' ? 'Done' : ''}
            </span>
          </button>

          <button
            onClick={handleProposal}
            disabled={proposalStatus === 'running'}
            className="flex items-center justify-between px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium text-purple-800">Generate Proposal</p>
              <p className="text-xs text-purple-600">AI-powered bid proposal creation</p>
            </div>
            <span className={`text-sm font-medium ${statusColor(proposalStatus)}`}>
              {proposalStatus === 'running' ? 'Generating...' : proposalStatus === 'success' ? 'Done' : ''}
            </span>
          </button>

          <button
            onClick={handleAssess}
            disabled={assessStatus === 'running'}
            className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium text-amber-800">Assess Proposal</p>
              <p className="text-xs text-amber-600">Identify shortcomings and improvements</p>
            </div>
            <span className={`text-sm font-medium ${statusColor(assessStatus)}`}>
              {assessStatus === 'running' ? 'Assessing...' : assessStatus === 'success' ? 'Done' : ''}
            </span>
          </button>

          <button
            onClick={handleFullPipeline}
            disabled={downloadStatus === 'running' || proposalStatus === 'running' || assessStatus === 'running'}
            className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium text-green-800">Run Full Pipeline</p>
              <p className="text-xs text-green-600">Download &rarr; Proposal &rarr; Assessment</p>
            </div>
          </button>
        </div>

        {error && (
          <div className="mt-4 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Progress */}
      <PipelineStatus events={events} />

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Result</h3>
          <pre className="bg-slate-50 p-4 rounded-lg text-sm overflow-auto max-h-96 text-slate-700">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import type { BidResult } from '../services/api.js';

interface Props {
  results: BidResult[];
  onSelectBid: (bid: BidResult) => void;
  loading: boolean;
}

export default function BidList({ results, onSelectBid, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-slate-600">Searching GEM portal...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-lg">No bids found</p>
        <p className="text-sm mt-1">Try searching with different keywords or filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 mb-3">
        Found {results.length} bid(s)
      </p>
      {results.map((bid) => (
        <div
          key={bid.bidId}
          onClick={() => onSelectBid(bid)}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase">
                  {bid.bidType}
                </span>
                <span className="text-sm font-mono text-slate-500">
                  {bid.bidNumber || bid.bidId}
                </span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">
                {bid.title}
              </h3>
              <p className="text-sm text-slate-600">{bid.department}</p>
              {bid.items.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {bid.items.slice(0, 3).map((item, i) => (
                    <span
                      key={i}
                      className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                    >
                      {item}
                    </span>
                  ))}
                  {bid.items.length > 3 && (
                    <span className="text-xs text-slate-400">
                      +{bid.items.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right text-sm ml-4">
              {bid.estimatedValue && (
                <p className="font-semibold text-green-700">
                  {bid.estimatedValue}
                </p>
              )}
              <p className="text-slate-500 mt-1">
                Ends: {bid.endDate || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

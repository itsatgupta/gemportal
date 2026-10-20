import React, { useState } from 'react';
import SearchForm from './components/SearchForm.js';
import BidList from './components/BidList.js';
import BidDetail from './components/BidDetail.js';
import type { BidResult } from './services/api.js';

type View = 'search' | 'detail';

export default function App() {
  const [view, setView] = useState<View>('search');
  const [results, setResults] = useState<BidResult[]>([]);
  const [selectedBid, setSelectedBid] = useState<BidResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectBid = (bid: BidResult) => {
    setSelectedBid(bid);
    setView('detail');
  };

  const handleBack = () => {
    setView('search');
    setSelectedBid(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1
            className="text-2xl font-bold cursor-pointer"
            onClick={handleBack}
          >
            GemPortal
          </h1>
          <span className="text-indigo-200 text-sm">
            GEM Bid Management System
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === 'search' && (
          <>
            <SearchForm
              onResults={setResults}
              loading={loading}
              setLoading={setLoading}
            />
            <BidList
              results={results}
              onSelectBid={handleSelectBid}
              loading={loading}
            />
          </>
        )}

        {view === 'detail' && selectedBid && (
          <BidDetail bid={selectedBid} onBack={handleBack} />
        )}
      </main>
    </div>
  );
}

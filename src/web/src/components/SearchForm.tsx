import React, { useState } from 'react';
import { searchBids, type BidResult } from '../services/api.js';

interface Props {
  onResults: (results: BidResult[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const BID_TYPES = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'custom', label: 'Custom Bid' },
  { value: 'boq', label: 'BOQ' },
  { value: 'gt', label: 'Global Tender' },
];

export default function SearchForm({ onResults, loading, setLoading }: Props) {
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState<'fullText' | 'exact'>('fullText');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (searchText.length < 3) {
      setError('Search text must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      const data = await searchBids({
        searchText,
        searchType,
        bidTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      });
      onResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      onResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">
        Search Open GEM Portal Bids
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Searches only ongoing bids (closing today or later)
      </p>

      {/* Search input */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Enter bid keywords (e.g., HAZOP, QRA, safety audit)..."
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'fullText' | 'exact')}
          className="px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="fullText">Contains</option>
          <option value="exact">Exact Match</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Bid type filter */}
      <div>
        <label className="block text-sm text-slate-600 mb-1">Bid Type</label>
        <div className="flex gap-2 flex-wrap">
          {BID_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleType(t.value)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selectedTypes.includes(t.value)
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-3 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
    </form>
  );
}
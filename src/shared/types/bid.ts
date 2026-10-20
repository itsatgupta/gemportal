export interface BidSearchFilters {
  searchText: string;
  searchType?: 'fullText' | 'exact';
  bidTypes?: BidType[];
  fromEndDate?: string;
  toEndDate?: string;
  highValueOnly?: boolean;
  page?: number;
  sortBy?: 'startDate' | 'endDate';
  sortOrder?: 'asc' | 'desc';
}

export type BidType =
  | 'product'
  | 'service'
  | 'bidToRA'
  | 'custom'
  | 'boq'
  | 'rcbid'
  | 'gt';

export interface BidSearchResult {
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

export interface BidDetail extends BidSearchResult {
  scopeOfWork?: string;
  qualificationCriteria?: string;
  paymentTerms?: string;
  documents: BidDocument[];
}

export interface BidDocument {
  url: string;
  type: BidDocType;
  filename: string;
  bidId: string;
}

export type BidDocType =
  | 'biddoc'
  | 'excel'
  | 'gtc'
  | 'sla'
  | 'ompp'
  | 'other';

export interface BidMetadata {
  bidId: string;
  bidNumber: string;
  downloadedAt: string;
  documents: BidDocument[];
  workDir: string;
}

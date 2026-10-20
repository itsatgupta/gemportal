import type { BidSearchResult } from '../../shared/types/bid.js';

/**
 * GEM portal /all-bids-data returns JSON:
 * {
 *   status: 1,
 *   code: 200,
 *   message: "Bid result",
 *   response: {
 *     response: {
 *       numFound: N,
 *       start: 0,
 *       docs: [ { id, b_id, b_bid_number, b_category_name, ... } ]
 *     }
 *   }
 * }
 *
 * Each doc has array-wrapped fields from Solr.
 */

interface SolrDoc {
  id: string | number;
  b_id?: (string | number)[];
  b_bid_number?: string[];
  b_category_name?: string[];
  bd_category_name?: string[];
  b_total_quantity?: number[];
  b_status?: number[];
  b_bid_type?: number[];
  b_type?: number[];
  b_cat_id?: string[];
  final_start_date_sort?: string[];
  final_end_date_sort?: string[];
  ba_official_details_minName?: string[];
  ba_official_details_deptName?: string[];
  is_high_value?: boolean[];
  ba_is_global_tendering?: number[];
  is_rc_bid?: number[];
  b_is_custom_item?: number[];
  b_bid_to_ra?: number[];
  [key: string]: unknown;
}

interface GemApiResponse {
  status?: number;
  code?: number;
  message?: string;
  response?: {
    response?: {
      numFound?: number;
      start?: number;
      docs?: SolrDoc[];
    };
  };
}

export function parseBidSearchResults(responseStr: string): BidSearchResult[] {
  let parsed: GemApiResponse;

  try {
    parsed = JSON.parse(responseStr);
  } catch {
    return [];
  }

  if (!parsed || parsed.code !== 200) {
    return [];
  }

  const docs = parsed.response?.response?.docs ?? [];
  const results: BidSearchResult[] = [];

  for (const doc of docs) {
    const bidId = String(first(doc.b_id) ?? doc.id);
    const bidNumber = first(doc.b_bid_number) ?? bidId;
    const categoryName = first(doc.b_category_name) ?? first(doc.bd_category_name) ?? '';
    const ministry = first(doc.ba_official_details_minName) ?? '';
    const dept = first(doc.ba_official_details_deptName) ?? '';
    const department = dept && dept !== 'NA' ? `${ministry} - ${dept}` : ministry;

    const startDateRaw = first(doc.final_start_date_sort) ?? '';
    const endDateRaw = first(doc.final_end_date_sort) ?? '';

    const quantity = first(doc.b_total_quantity);
    const bidType = resolveBidType(doc);

    // Build detail URL based on bid type
    const detailUrl = buildDetailUrl(bidId, doc);

    results.push({
      bidId,
      bidNumber,
      title: categoryName,
      department,
      items: categoryName ? [categoryName] : [],
      quantity: quantity != null ? String(quantity) : undefined,
      startDate: formatDate(startDateRaw),
      endDate: formatDate(endDateRaw),
      bidType,
      estimatedValue: undefined,
      detailUrl,
    });
  }

  return results;
}

export function parseTotalResults(responseStr: string): number {
  try {
    const parsed: GemApiResponse = JSON.parse(responseStr);
    return parsed.response?.response?.numFound ?? 0;
  } catch {
    return 0;
  }
}

/** Extract first element from a Solr array field */
function first<T>(arr: T[] | undefined): T | undefined {
  return arr?.[0];
}

/** Format ISO date string to readable format */
function formatDate(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

/** Determine bid type from Solr doc fields */
function resolveBidType(doc: SolrDoc): string {
  const catId = first(doc.b_cat_id) ?? '';
  const isRc = first(doc.is_rc_bid) === 1;
  const isGlobal = first(doc.ba_is_global_tendering) === 1;
  const bidToRa = first(doc.b_bid_to_ra) === 1;

  if (isRc) return 'rcbid';
  if (isGlobal) return 'gt';
  if (bidToRa) return 'bidToRA';
  if (catId.includes('cust')) return 'custom';
  if (catId.includes('service')) return 'service';
  if (catId.includes('product')) return 'product';
  if (catId.includes('boq')) return 'boq';

  // Fallback: check b_type
  const bType = first(doc.b_type);
  if (bType === 2) return 'service';
  return 'product';
}

/** Build the correct detail page URL based on bid type */
function buildDetailUrl(bidId: string, doc: SolrDoc): string {
  const base = 'https://bidplus.gem.gov.in';
  const bidToRa = first(doc.b_bid_to_ra) === 1;

  if (bidToRa) {
    return `${base}/showradocumentPdf/${bidId}`;
  }
  return `${base}/showbidDocument/${bidId}`;
}
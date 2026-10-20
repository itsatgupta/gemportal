import * as cheerio from 'cheerio';
import path from 'node:path';
import type { BidDocument, BidDocType } from '../../shared/types/bid.js';

const DOCUMENT_URL_PATTERNS = [
  // Bid documents and excel files
  /bidplus\.gem\.gov\.in\/resources\/upload_nas\/.+/,
  // General Terms and Conditions
  /admin\.gem\.gov\.in\/apis\/v1\/gtc\/pdfByDate\/.*/,
  // OMPP documents
  /bidplus\.gem\.gov\.in\/bidding\/downloadOmppdfile\/.*/,
  // SLA/Contract documents
  /fulfilment\.gem\.gov\.in\/contract\/slafds.*/,
  // Any direct PDF/XLSX links from the portal
  /bidplus\.gem\.gov\.in\/.+\.(pdf|xlsx|xls|doc|docx)/i,
];

export function extractDocumentLinks(
  html: string,
  bidId: string,
): BidDocument[] {
  const $ = cheerio.load(html);
  const urlSet = new Set<string>();
  const documents: BidDocument[] = [];

  // Find all anchor tags with downloadable document URLs
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    processUrl(href, bidId, urlSet, documents);
  });

  // Find URLs in onclick handlers
  $('[onclick]').each((_i, el) => {
    const onclick = $(el).attr('onclick') ?? '';
    const urlMatches = onclick.match(/https?:\/\/[^\s'"]+/g);
    urlMatches?.forEach((url) => processUrl(url, bidId, urlSet, documents));
  });

  // Find URLs in embedded script tags
  $('script').each((_i, el) => {
    const scriptContent = $(el).html() ?? '';
    const urlMatches = scriptContent.match(/https?:\/\/[^\s'"]+\.(pdf|xlsx|xls|doc|docx)/gi);
    urlMatches?.forEach((url) => processUrl(url, bidId, urlSet, documents));
  });

  // Find iframe sources (embedded PDF viewers)
  $('iframe[src]').each((_i, el) => {
    const src = $(el).attr('src');
    if (src) processUrl(src, bidId, urlSet, documents);
  });

  // Also scan raw HTML for URLs that might be in data attributes or embedded
  const rawUrlMatches = html.match(
    /https?:\/\/(?:bidplus\.gem\.gov\.in|admin\.gem\.gov\.in|fulfilment\.gem\.gov\.in)[^\s"'<>]+/g,
  );
  rawUrlMatches?.forEach((url) => processUrl(url, bidId, urlSet, documents));

  return documents;
}

function processUrl(
  url: string,
  bidId: string,
  seen: Set<string>,
  documents: BidDocument[],
): void {
  // Clean the URL
  const cleanUrl = url.trim().replace(/&amp;/g, '&');
  if (seen.has(cleanUrl)) return;

  // Check against known patterns
  const isDocument = DOCUMENT_URL_PATTERNS.some((pattern) =>
    pattern.test(cleanUrl),
  );
  if (!isDocument) return;

  seen.add(cleanUrl);

  const type = classifyDocType(cleanUrl);
  const filename = extractFilename(cleanUrl, type, documents.length);

  documents.push({
    url: cleanUrl,
    type,
    filename,
    bidId,
  });
}

function classifyDocType(url: string): BidDocType {
  if (url.includes('/excel/') || /\.(xlsx|xls)$/i.test(url)) return 'excel';
  if (url.includes('/gtc/') || url.includes('pdfByDate')) return 'gtc';
  if (url.includes('slafds')) return 'sla';
  if (url.includes('downloadOmppdfile')) return 'ompp';
  if (url.includes('/biddoc/') || url.includes('/bidding/')) return 'biddoc';
  return 'other';
}

function extractFilename(
  url: string,
  type: BidDocType,
  index: number,
): string {
  // Try to extract filename from URL path
  const urlPath = new URL(url).pathname;
  const baseName = path.basename(urlPath);

  // If the filename is just a timestamp or hash, give it a meaningful name
  if (/^\d+\.\w+$/.test(baseName)) {
    const ext = path.extname(baseName);
    const typeNames: Record<BidDocType, string> = {
      biddoc: 'BidDocument',
      excel: 'ExcelTemplate',
      gtc: 'GeneralTerms',
      sla: 'SLADocument',
      ompp: 'OMPP',
      other: 'Document',
    };
    return `${typeNames[type]}_${index + 1}${ext}`;
  }

  // If it has a readable name, keep it
  if (baseName && baseName.length > 3) {
    return decodeURIComponent(baseName);
  }

  return `${type}_${index + 1}.pdf`;
}

import type { BidAnalysis } from '../../shared/types/proposal.js';

const MAX_DOC_CHARS = 50_000;

export function buildBidAnalysisPrompt(documentTexts: string): string {
  const truncated =
    documentTexts.length > MAX_DOC_CHARS
      ? documentTexts.slice(0, MAX_DOC_CHARS) + '\n...[truncated]'
      : documentTexts;

  return `You are analyzing GEM (Government e-Marketplace of India) bid documents.

Extract the following information in JSON format:

{
  "scopeOfWork": "detailed description of work required",
  "qualificationCriteria": {
    "technical": ["list of technical qualification criteria"],
    "financial": ["list of financial qualification criteria"]
  },
  "evaluationMethodology": "how bids will be evaluated",
  "mandatoryDocuments": ["list of documents required for submission"],
  "keyDates": {
    "submission": "submission deadline if found",
    "completion": "project completion date if found"
  },
  "deliverables": ["list of expected deliverables"],
  "specialConditions": ["any special conditions or requirements"]
}

BID DOCUMENTS:
${truncated}`;
}

export function buildCompanyMappingPrompt(
  bidAnalysis: BidAnalysis,
  companyDocsText: string,
): string {
  const truncated =
    companyDocsText.length > MAX_DOC_CHARS
      ? companyDocsText.slice(0, MAX_DOC_CHARS) + '\n...[truncated]'
      : companyDocsText;

  return `You are mapping a company's capabilities to GEM bid requirements.

BID REQUIREMENTS:
- Scope: ${bidAnalysis.scopeOfWork}
- Technical Criteria: ${bidAnalysis.qualificationCriteria.technical.join(', ')}
- Financial Criteria: ${bidAnalysis.qualificationCriteria.financial.join(', ')}
- Mandatory Documents: ${bidAnalysis.mandatoryDocuments.join(', ')}
- Deliverables: ${bidAnalysis.deliverables.join(', ')}

Analyze the company documents and return JSON:
{
  "capabilities": ["list of relevant company capabilities that match bid requirements"],
  "experience": ["relevant past project experience"],
  "certifications": ["relevant certifications and licenses"],
  "teamQualifications": ["team member qualifications relevant to this bid"],
  "gaps": ["identified gaps between bid requirements and company capabilities"]
}

COMPANY DOCUMENTS:
${truncated}`;
}

export function buildProposalPrompt(
  bidAnalysis: BidAnalysis,
  companyCapabilities: string,
): string {
  return `You are an expert bid proposal writer for Indian Government e-Marketplace (GEM) tenders.

Create a comprehensive bid proposal with the following sections. The proposal should be professional,
detailed, and directly address all bid requirements. Use formal business language appropriate for
government procurement.

BID REQUIREMENTS:
- Scope of Work: ${bidAnalysis.scopeOfWork}
- Technical Criteria: ${bidAnalysis.qualificationCriteria.technical.join('; ')}
- Financial Criteria: ${bidAnalysis.qualificationCriteria.financial.join('; ')}
- Deliverables: ${bidAnalysis.deliverables.join('; ')}
- Special Conditions: ${bidAnalysis.specialConditions.join('; ')}

COMPANY CAPABILITIES:
${companyCapabilities}

Generate the proposal with these sections (each section as a JSON object):
[
  { "title": "Executive Summary", "content": "..." },
  { "title": "Technical Approach & Methodology", "content": "..." },
  { "title": "Project Plan & Timeline", "content": "..." },
  { "title": "Team Composition & Qualifications", "content": "..." },
  { "title": "Past Experience & References", "content": "..." },
  { "title": "Quality Assurance Plan", "content": "..." },
  { "title": "Compliance Matrix", "content": "table showing each requirement and how it is met" },
  { "title": "Commercial Proposal", "content": "pricing approach and value proposition with optimal bid value recommendation" }
]

Return ONLY valid JSON array of sections.`;
}

export function buildRefinementPrompt(
  proposalDraft: string,
  bidAnalysis: BidAnalysis,
): string {
  return `You are reviewing a GEM bid proposal draft for completeness and quality.

BID REQUIREMENTS SUMMARY:
- Scope: ${bidAnalysis.scopeOfWork}
- Criteria: ${bidAnalysis.qualificationCriteria.technical.join('; ')}
- Mandatory Docs: ${bidAnalysis.mandatoryDocuments.join('; ')}

DRAFT PROPOSAL:
${proposalDraft}

Review the proposal and provide an improved version that:
1. Ensures all bid requirements are explicitly addressed
2. Strengthens weak sections with more specific details
3. Adds any missing mandatory compliance statements
4. Improves professional language and formatting
5. Ensures the commercial section provides a competitive yet profitable bid value

Return the refined proposal as the same JSON array of sections format.`;
}

export const SYSTEM_PROMPT = `You are an expert at Indian Government procurement and GEM (Government e-Marketplace) bidding processes. You have deep knowledge of:
- GeM portal bidding procedures and requirements
- Indian government procurement rules and guidelines
- Technical proposal writing for government contracts
- Compliance requirements for GEM bids
- Competitive pricing strategies for government tenders

Always be precise, factual, and provide actionable content. When analyzing documents, extract all relevant information systematically.`;

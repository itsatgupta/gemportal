import path from 'node:path';
import type { Agent, AgentContext, AgentResult } from '../../shared/types/agent.js';
import type {
  BidAnalysis,
  CompanyProfile,
  GeneratedProposal,
  ProposalSection,
} from '../../shared/types/proposal.js';
import type { AIProvider } from '../../shared/providers/aiProvider.js';
import { readAllDocuments, summarizeDocuments } from './docReader.js';
import {
  buildBidAnalysisPrompt,
  buildCompanyMappingPrompt,
  buildProposalPrompt,
  buildRefinementPrompt,
  SYSTEM_PROMPT,
} from './promptBuilder.js';
import { generateDocx, generatePdf } from './docGenerator.js';
import { eventBus } from '../../orchestrator/eventBus.js';
import { ensureDir, getBidProposalsDir } from '../../shared/utils/fileSystem.js';

export interface ProposalInput {
  bidId: string;
  documentsDir: string;
  companyDocsDir: string;
}

export class ProposalAgent implements Agent<ProposalInput, GeneratedProposal> {
  name = 'proposal';
  private ai: AIProvider;

  constructor(ai: AIProvider) {
    this.ai = ai;
  }

  async execute(
    input: ProposalInput,
    ctx: AgentContext,
  ): Promise<AgentResult<GeneratedProposal>> {
    const start = Date.now();
    const { bidId, documentsDir, companyDocsDir } = input;

    try {
      // Pass 1: Read and analyze bid documents
      eventBus.emitProgress(this.name, bidId, 'Reading bid documents...', 5);
      const bidDocs = await readAllDocuments(documentsDir);
      const bidDocsText = summarizeDocuments(bidDocs);

      eventBus.emitProgress(this.name, bidId, 'Analyzing bid requirements...', 15);
      const analysisPrompt = buildBidAnalysisPrompt(bidDocsText);
      const analysisRaw = await this.ai.generateText(
        SYSTEM_PROMPT,
        analysisPrompt,
        { maxTokens: 4096 },
      );
      const bidAnalysis = this.parseJson<BidAnalysis>(analysisRaw, bidId);

      // Pass 2: Read company documents and map capabilities
      eventBus.emitProgress(this.name, bidId, 'Reading company documents...', 30);
      const companyDocs = await readAllDocuments(companyDocsDir);
      const companyDocsText = summarizeDocuments(companyDocs);

      eventBus.emitProgress(
        this.name,
        bidId,
        'Mapping company capabilities...',
        40,
      );
      const mappingPrompt = buildCompanyMappingPrompt(bidAnalysis, companyDocsText);
      const mappingRaw = await this.ai.generateText(
        SYSTEM_PROMPT,
        mappingPrompt,
        { maxTokens: 4096 },
      );
      const companyProfile = this.parseJson<CompanyProfile>(mappingRaw, bidId);

      // Pass 3: Generate proposal
      eventBus.emitProgress(this.name, bidId, 'Generating proposal...', 55);
      const proposalPrompt = buildProposalPrompt(
        bidAnalysis,
        JSON.stringify(companyProfile, null, 2),
      );
      const proposalRaw = await this.ai.generateText(
        SYSTEM_PROMPT,
        proposalPrompt,
        { maxTokens: 8192 },
      );
      let sections = this.parseJson<ProposalSection[]>(proposalRaw, bidId);

      // Pass 4: Refine
      eventBus.emitProgress(this.name, bidId, 'Refining proposal...', 70);
      const refinementPrompt = buildRefinementPrompt(
        JSON.stringify(sections, null, 2),
        bidAnalysis,
      );
      const refinedRaw = await this.ai.generateText(
        SYSTEM_PROMPT,
        refinementPrompt,
        { maxTokens: 8192 },
      );

      try {
        sections = this.parseJson<ProposalSection[]>(refinedRaw, bidId);
      } catch {
        // Keep original sections if refinement parsing fails
      }

      // Generate output documents
      eventBus.emitProgress(this.name, bidId, 'Generating documents...', 85);
      const proposalsDir = getBidProposalsDir(ctx.config.paths.bidsDir, bidId);
      await ensureDir(proposalsDir);

      const docxPath = path.join(proposalsDir, `Proposal-${bidId}.docx`);
      const pdfPath = path.join(proposalsDir, `Proposal-${bidId}.pdf`);
      const title = `Bid Proposal - ${bidId}`;

      await Promise.all([
        generateDocx(sections, docxPath, title),
        generatePdf(sections, pdfPath, title),
      ]);

      eventBus.emitProgress(this.name, bidId, 'Proposal generated', 100);

      return {
        success: true,
        data: {
          bidId,
          sections,
          outputDocx: docxPath,
          outputPdf: pdfPath,
          generatedAt: new Date().toISOString(),
        },
        errors: [],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'PROPOSAL_FAILED',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        durationMs: Date.now() - start,
      };
    }
  }

  private parseJson<T>(raw: string, bidId: string): T {
    // Try to extract JSON from the response (may have markdown code blocks)
    let jsonStr = raw.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON array or object
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    const start = Math.min(
      firstBrace >= 0 ? firstBrace : Infinity,
      firstBracket >= 0 ? firstBracket : Infinity,
    );

    if (start !== Infinity) {
      jsonStr = jsonStr.slice(start);
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse AI response as JSON for bid ${bidId}: ${err}`,
      );
    }
  }
}

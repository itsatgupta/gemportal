import path from 'node:path';
import type { Agent, AgentContext, AgentResult } from '../../shared/types/agent.js';
import type { AssessmentReport } from '../../shared/types/proposal.js';
import type { AIProvider } from '../../shared/providers/aiProvider.js';
import { readAllDocuments, summarizeDocuments } from '../proposal/docReader.js';
import { extractEvaluationCriteria } from './criteriaExtractor.js';
import { evaluateProposal } from './evaluator.js';
import {
  generateAssessmentDocx,
  generateAssessmentPdf,
} from './reportGenerator.js';
import { eventBus } from '../../orchestrator/eventBus.js';
import {
  ensureDir,
  getBidAssessmentsDir,
  getBidDocumentsDir,
  getBidProposalsDir,
} from '../../shared/utils/fileSystem.js';

export interface AssessmentInput {
  bidId: string;
  proposalPath?: string;
}

export class AssessmentAgent implements Agent<AssessmentInput, AssessmentReport> {
  name = 'assessment';
  private ai: AIProvider;

  constructor(ai: AIProvider) {
    this.ai = ai;
  }

  async execute(
    input: AssessmentInput,
    ctx: AgentContext,
  ): Promise<AgentResult<AssessmentReport>> {
    const start = Date.now();
    const { bidId } = input;

    try {
      // Step 1: Read bid documents
      eventBus.emitProgress(this.name, bidId, 'Reading bid documents...', 10);
      const documentsDir = getBidDocumentsDir(ctx.config.paths.bidsDir, bidId);
      const bidDocs = await readAllDocuments(documentsDir);
      const bidDocsText = summarizeDocuments(bidDocs);

      // Step 2: Read proposal
      eventBus.emitProgress(this.name, bidId, 'Reading proposal...', 20);
      const proposalsDir = getBidProposalsDir(ctx.config.paths.bidsDir, bidId);
      const proposalDocs = await readAllDocuments(proposalsDir);
      const proposalText = summarizeDocuments(proposalDocs);

      if (!proposalText.trim()) {
        return {
          success: false,
          errors: [
            {
              code: 'NO_PROPOSAL',
              message: 'No proposal found. Generate a proposal first.',
            },
          ],
          durationMs: Date.now() - start,
        };
      }

      // Step 3: Extract evaluation criteria from bid docs
      eventBus.emitProgress(
        this.name,
        bidId,
        'Extracting evaluation criteria...',
        35,
      );
      const criteria = await extractEvaluationCriteria(bidDocsText, this.ai);

      // Step 4: Evaluate proposal against criteria
      eventBus.emitProgress(
        this.name,
        bidId,
        'Evaluating proposal...',
        55,
      );
      const evaluation = await evaluateProposal(
        proposalText,
        criteria,
        bidDocsText,
        this.ai,
      );

      // Step 5: Generate report documents
      eventBus.emitProgress(this.name, bidId, 'Generating report...', 80);
      const assessmentsDir = getBidAssessmentsDir(
        ctx.config.paths.bidsDir,
        bidId,
      );
      await ensureDir(assessmentsDir);

      const docxPath = path.join(assessmentsDir, `Assessment-${bidId}.docx`);
      const pdfPath = path.join(assessmentsDir, `Assessment-${bidId}.pdf`);

      const report: AssessmentReport = {
        bidId,
        overallScore: evaluation.overallScore,
        overallVerdict: evaluation.overallVerdict,
        sections: evaluation.sections,
        shortcomings: evaluation.shortcomings,
        recommendations: evaluation.recommendations,
        generatedAt: new Date().toISOString(),
        outputDocx: docxPath,
        outputPdf: pdfPath,
      };

      await Promise.all([
        generateAssessmentDocx(report, docxPath),
        generateAssessmentPdf(report, pdfPath),
      ]);

      eventBus.emitProgress(this.name, bidId, 'Assessment complete', 100);

      return {
        success: true,
        data: report,
        errors: [],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'ASSESSMENT_FAILED',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        durationMs: Date.now() - start,
      };
    }
  }
}

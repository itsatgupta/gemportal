import type { AIProvider } from '../../shared/providers/aiProvider.js';
import type { AssessmentSection, Shortcoming } from '../../shared/types/proposal.js';
import type { EvaluationCriteria } from './criteriaExtractor.js';
import { SYSTEM_PROMPT } from '../proposal/promptBuilder.js';

export interface EvaluationResult {
  sections: AssessmentSection[];
  shortcomings: Shortcoming[];
  overallScore: number;
  overallVerdict: 'strong' | 'adequate' | 'weak' | 'non-compliant';
  recommendations: string[];
}

export async function evaluateProposal(
  proposalText: string,
  criteria: EvaluationCriteria,
  bidDocsText: string,
  ai: AIProvider,
): Promise<EvaluationResult> {
  const prompt = `You are an expert GEM bid evaluator. Assess the following proposal against the evaluation criteria.

EVALUATION CRITERIA:
${JSON.stringify(criteria.criteria, null, 2)}

Total Maximum Score: ${criteria.totalMaxScore}

BID REQUIREMENTS (for reference):
${bidDocsText.slice(0, 30000)}

PROPOSAL TO EVALUATE:
${proposalText.slice(0, 40000)}

Evaluate each criterion and return JSON:
{
  "sections": [
    {
      "criterion": "criterion description",
      "score": 7,
      "maxScore": 10,
      "comment": "assessment comment"
    }
  ],
  "shortcomings": [
    {
      "severity": "critical|major|minor",
      "criterion": "which criterion this relates to",
      "description": "what is missing or inadequate",
      "suggestion": "specific actionable suggestion to fix"
    }
  ],
  "overallScore": 72,
  "overallVerdict": "strong|adequate|weak|non-compliant",
  "recommendations": [
    "priority recommendation 1",
    "priority recommendation 2"
  ]
}

Be thorough and critical. Identify ALL shortcomings, especially:
- Missing mandatory requirements
- Weak or vague responses to specific criteria
- Missing supporting evidence or references
- Compliance gaps
- Areas where the proposal could be strengthened`;

  const raw = await ai.generateText(SYSTEM_PROMPT, prompt, {
    maxTokens: 8192,
  });

  // Parse JSON
  let jsonStr = raw.trim();
  const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) jsonStr = match[1].trim();

  const first = jsonStr.indexOf('{');
  if (first > 0) jsonStr = jsonStr.slice(first);

  return JSON.parse(jsonStr) as EvaluationResult;
}

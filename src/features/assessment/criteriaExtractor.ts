import type { AIProvider } from '../../shared/providers/aiProvider.js';
import { SYSTEM_PROMPT } from '../proposal/promptBuilder.js';

export interface EvaluationCriteria {
  criteria: CriterionItem[];
  totalMaxScore: number;
}

export interface CriterionItem {
  id: string;
  category: string;
  description: string;
  maxScore: number;
  mandatory: boolean;
}

export async function extractEvaluationCriteria(
  bidDocsText: string,
  ai: AIProvider,
): Promise<EvaluationCriteria> {
  const prompt = `Analyze these GEM bid documents and extract ALL evaluation criteria.

For each criterion, identify:
1. Category (Technical, Financial, Experience, Compliance, etc.)
2. Specific requirement description
3. Maximum score/weightage (estimate if not explicitly stated)
4. Whether it is mandatory (pass/fail) or scored

Return JSON format:
{
  "criteria": [
    {
      "id": "TC-1",
      "category": "Technical",
      "description": "description of the criterion",
      "maxScore": 10,
      "mandatory": true
    }
  ],
  "totalMaxScore": 100
}

BID DOCUMENTS:
${bidDocsText.slice(0, 50000)}`;

  const raw = await ai.generateText(SYSTEM_PROMPT, prompt, { maxTokens: 4096 });

  // Parse JSON from response
  let jsonStr = raw.trim();
  const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) jsonStr = match[1].trim();

  const first = jsonStr.indexOf('{');
  if (first > 0) jsonStr = jsonStr.slice(first);

  return JSON.parse(jsonStr) as EvaluationCriteria;
}

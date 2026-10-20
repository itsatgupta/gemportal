import type { AssessmentReport, Shortcoming } from '../../shared/types/proposal.js';
import { generateDocx, generatePdf } from '../proposal/docGenerator.js';

export function buildAssessmentSections(report: AssessmentReport) {
  const sections = [
    {
      title: 'Assessment Summary',
      content: [
        `Bid ID: ${report.bidId}`,
        `Overall Score: ${report.overallScore}/100`,
        `Verdict: ${report.overallVerdict.toUpperCase()}`,
        `Assessment Date: ${report.generatedAt}`,
        '',
        `Total Shortcomings: ${report.shortcomings.length}`,
        `  Critical: ${report.shortcomings.filter((s) => s.severity === 'critical').length}`,
        `  Major: ${report.shortcomings.filter((s) => s.severity === 'major').length}`,
        `  Minor: ${report.shortcomings.filter((s) => s.severity === 'minor').length}`,
      ].join('\n'),
    },
    {
      title: 'Detailed Scoring',
      content: report.sections
        .map(
          (s) =>
            `${s.criterion}: ${s.score}/${s.maxScore}\n  ${s.comment}`,
        )
        .join('\n\n'),
    },
    {
      title: 'Shortcomings - Critical',
      content: formatShortcomings(
        report.shortcomings.filter((s) => s.severity === 'critical'),
      ),
    },
    {
      title: 'Shortcomings - Major',
      content: formatShortcomings(
        report.shortcomings.filter((s) => s.severity === 'major'),
      ),
    },
    {
      title: 'Shortcomings - Minor',
      content: formatShortcomings(
        report.shortcomings.filter((s) => s.severity === 'minor'),
      ),
    },
    {
      title: 'Recommendations',
      content: report.recommendations
        .map((r, i) => `${i + 1}. ${r}`)
        .join('\n\n'),
    },
  ];

  return sections;
}

function formatShortcomings(shortcomings: Shortcoming[]): string {
  if (shortcomings.length === 0) return 'None identified.';

  return shortcomings
    .map(
      (s, i) =>
        `${i + 1}. [${s.severity.toUpperCase()}] ${s.criterion}\n` +
        `   Issue: ${s.description}\n` +
        `   Suggestion: ${s.suggestion}`,
    )
    .join('\n\n');
}

export async function generateAssessmentDocx(
  report: AssessmentReport,
  outputPath: string,
): Promise<void> {
  const sections = buildAssessmentSections(report);
  await generateDocx(sections, outputPath, `Bid Assessment - ${report.bidId}`);
}

export async function generateAssessmentPdf(
  report: AssessmentReport,
  outputPath: string,
): Promise<void> {
  const sections = buildAssessmentSections(report);
  await generatePdf(sections, outputPath, `Bid Assessment - ${report.bidId}`);
}

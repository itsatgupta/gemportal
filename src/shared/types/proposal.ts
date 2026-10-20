export interface BidAnalysis {
  bidId: string;
  scopeOfWork: string;
  qualificationCriteria: {
    technical: string[];
    financial: string[];
  };
  evaluationMethodology: string;
  mandatoryDocuments: string[];
  keyDates: {
    submission?: string;
    completion?: string;
  };
  deliverables: string[];
  specialConditions: string[];
}

export interface CompanyProfile {
  capabilities: string[];
  experience: string[];
  certifications: string[];
  teamQualifications: string[];
  gaps: string[];
}

export interface GeneratedProposal {
  bidId: string;
  sections: ProposalSection[];
  outputDocx: string;
  outputPdf: string;
  generatedAt: string;
}

export interface ProposalSection {
  title: string;
  content: string;
}

export interface AssessmentReport {
  bidId: string;
  overallScore: number;
  overallVerdict: 'strong' | 'adequate' | 'weak' | 'non-compliant';
  sections: AssessmentSection[];
  shortcomings: Shortcoming[];
  recommendations: string[];
  generatedAt: string;
  outputDocx: string;
  outputPdf: string;
}

export interface AssessmentSection {
  criterion: string;
  score: number;
  maxScore: number;
  comment: string;
}

export interface Shortcoming {
  severity: 'critical' | 'major' | 'minor';
  criterion: string;
  description: string;
  suggestion: string;
}

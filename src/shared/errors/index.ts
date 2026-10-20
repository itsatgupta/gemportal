export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class GemPortalError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'GEM_PORTAL_ERROR', 502, details);
    this.name = 'GemPortalError';
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'AI_PROVIDER_ERROR', 503, details);
    this.name = 'AIProviderError';
  }
}

export class DocumentError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'DOCUMENT_ERROR', 500, details);
    this.name = 'DocumentError';
  }
}

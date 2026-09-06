export type SettingsErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONCURRENCY_CONFLICT';

const messages: Record<SettingsErrorCode, string> = {
  VALIDATION_ERROR: 'Check the highlighted settings and try again.',
  NOT_FOUND: 'The workspace settings could not be found.',
  CONCURRENCY_CONFLICT:
    'These settings changed elsewhere. Refresh and review the latest version.',
};

export interface SettingsErrorDetail {
  field: string;
  message: string;
}

export class SettingsError extends Error {
  constructor(
    public readonly code: SettingsErrorCode,
    public readonly statusCode: number,
    public readonly details?: SettingsErrorDetail[],
  ) {
    super(messages[code]);
  }
}

export function settingsErrorResponse(error: SettingsError) {
  return {
    statusCode: error.statusCode,
    body: {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
  };
}

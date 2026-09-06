export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'VERIFICATION_FAILED'
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'CSRF_INVALID'
  | 'PASSWORD_POLICY'
  | 'CURRENT_PASSWORD_INVALID'
  | 'PASSWORD_REUSE'
  | 'ADMIN_ALREADY_EXISTS'
  | 'INTERNAL_ERROR';

const messages: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  VERIFICATION_FAILED: 'Verification could not be completed. Please try again.',
  UNAUTHORIZED: 'Authentication is required.',
  INVALID_REQUEST: 'The request is invalid.',
  CSRF_INVALID: 'The security check failed. Refresh the page and try again.',
  PASSWORD_POLICY: 'Use a password between 12 and 128 characters.',
  CURRENT_PASSWORD_INVALID: 'The current password is incorrect.',
  PASSWORD_REUSE: 'Choose a password different from the current password.',
  ADMIN_ALREADY_EXISTS: 'An active Super Admin already exists.',
  INTERNAL_ERROR: 'The request could not be completed.',
};

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly statusCode = 401,
  ) {
    super(messages[code]);
  }
}

export function publicAuthError(error: unknown) {
  const safe =
    error instanceof AuthError ? error : new AuthError('INTERNAL_ERROR', 500);
  return {
    statusCode: safe.statusCode,
    body: { error: { code: safe.code, message: safe.message } },
  };
}

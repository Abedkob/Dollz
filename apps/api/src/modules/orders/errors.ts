export type OrderErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ACCESS_DENIED'
  | 'ORDER_ACCESS_EXPIRED'
  | 'ORDER_ACCESS_REVOKED'
  | 'ORDER_VERSION_CONFLICT'
  | 'ORDER_INVALID_TRANSITION'
  | 'ORDER_ALREADY_SUBMITTED'
  | 'ORDER_CONFIGURATION_INVALID'
  | 'ORDER_CURRENCY_MISMATCH'
  | 'ORDER_NOT_APPROVABLE'
  | 'PAYMENT_ALREADY_REQUESTED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'PAYMENT_ALREADY_VERIFIED'
  | 'PAYMENT_REQUIRED'
  | 'REVISION_NOT_ACTIONABLE'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'TURNSTILE_FAILED';

const messages: Record<OrderErrorCode, string> = {
  ORDER_NOT_FOUND: 'The order could not be found.',
  ORDER_ACCESS_DENIED: 'This order link is not valid.',
  ORDER_ACCESS_EXPIRED: 'This order link has expired.',
  ORDER_ACCESS_REVOKED: 'This order link is no longer active.',
  ORDER_VERSION_CONFLICT:
    'This order changed elsewhere. Reload it before continuing.',
  ORDER_INVALID_TRANSITION: 'This action is not available for the order now.',
  ORDER_ALREADY_SUBMITTED: 'This submission key belongs to another request.',
  ORDER_CONFIGURATION_INVALID: 'Review the highlighted doll configuration.',
  ORDER_CURRENCY_MISMATCH: 'Every doll in an order must use one currency.',
  ORDER_NOT_APPROVABLE: 'The order is not ready for final approval.',
  PAYMENT_ALREADY_REQUESTED: 'An active payment request already exists.',
  PAYMENT_AMOUNT_MISMATCH: 'The payment does not match the final order total.',
  PAYMENT_ALREADY_VERIFIED: 'This payment was already verified.',
  PAYMENT_REQUIRED: 'Verified payment is required before production starts.',
  REVISION_NOT_ACTIONABLE: 'This revision can no longer be changed.',
  VALIDATION_ERROR: 'Check the highlighted information and try again.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  TURNSTILE_FAILED: 'Verification could not be completed. Please try again.',
};

export interface OrderErrorDetail {
  field: string;
  message: string;
}

export class OrderError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    public readonly statusCode: number,
    public readonly details?: OrderErrorDetail[],
  ) {
    super(messages[code]);
  }
}

export function orderErrorResponse(error: OrderError) {
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

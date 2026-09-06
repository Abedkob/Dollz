export type CatalogErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_SLUG'
  | 'DUPLICATE_SKU'
  | 'DUPLICATE_CODE'
  | 'CONCURRENCY_CONFLICT'
  | 'OPTION_CODE_LOCKED_BY_ORDER_HISTORY'
  | 'PRODUCT_NOT_PUBLISHABLE'
  | 'INVALID_STATUS_TRANSITION'
  | 'INVALID_FILE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_DECODE_FAILED'
  | 'FILE_REFERENCED'
  | 'CONFLICT';

const messages: Record<CatalogErrorCode, string> = {
  VALIDATION_ERROR: 'Check the highlighted information and try again.',
  NOT_FOUND: 'The requested catalog record was not found.',
  DUPLICATE_SLUG: 'A product already uses this slug.',
  DUPLICATE_SKU: 'A variant already uses this SKU.',
  DUPLICATE_CODE: 'This code is already in use.',
  CONCURRENCY_CONFLICT:
    'This record changed elsewhere. Refresh and review the latest version.',
  OPTION_CODE_LOCKED_BY_ORDER_HISTORY:
    'This option code is preserved because it appears in order history.',
  PRODUCT_NOT_PUBLISHABLE:
    'The product is missing required publishing information.',
  INVALID_STATUS_TRANSITION:
    'This change is not valid for the product in its current status.',
  INVALID_FILE: 'The uploaded image is invalid.',
  UNSUPPORTED_FILE_TYPE: 'Upload a JPEG, PNG, or WebP image.',
  FILE_TOO_LARGE: 'The image exceeds the upload size limit.',
  IMAGE_TOO_LARGE: 'The image dimensions exceed the permitted limit.',
  IMAGE_DECODE_FAILED: 'The image could not be decoded safely.',
  FILE_REFERENCED: 'This image is still in use and cannot be deleted.',
  CONFLICT: 'The requested change conflicts with existing catalog data.',
};

export interface ErrorDetail {
  field: string;
  message: string;
}

export class CatalogError extends Error {
  constructor(
    public readonly code: CatalogErrorCode,
    public readonly statusCode: number,
    public readonly details?: ErrorDetail[],
  ) {
    super(messages[code]);
  }
}

export function catalogErrorResponse(error: CatalogError) {
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

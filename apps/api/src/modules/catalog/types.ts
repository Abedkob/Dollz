import type { createAuthGuards } from '../auth/guards.js';

export type ReturnTypeOfGuards = ReturnType<typeof createAuthGuards>;

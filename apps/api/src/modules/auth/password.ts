import argon2 from 'argon2';
import { z } from 'zod';
import { AuthError } from './errors.js';

const passwordSchema = z.string().min(12).max(128);

export function assertPasswordPolicy(password: string, email: string): void {
  if (
    !passwordSchema.safeParse(password).success ||
    password.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    throw new AuthError('PASSWORD_POLICY', 400);
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

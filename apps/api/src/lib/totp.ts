import { generateSecret, generateURI, verify } from 'otplib';
import { env } from '../config/env.js';

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpProvisioningUri(secret: string, accountEmail: string): string {
  return generateURI({ issuer: env.TOTP_ISSUER, label: accountEmail, secret });
}

export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code, epochTolerance: 60 });
    return result.valid;
  } catch {
    return false;
  }
}

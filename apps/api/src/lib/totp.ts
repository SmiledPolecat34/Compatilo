import { OTP } from 'otplib';
import { env } from '../config/env.js';

const otp = new OTP({ strategy: 'totp' });

export function generateTotpSecret(): string {
  return otp.generateSecret();
}

export function totpProvisioningUri(secret: string, accountEmail: string): string {
  return otp.generateURI({ issuer: env.TOTP_ISSUER, label: accountEmail, secret });
}

export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  try {
    const result = await otp.verify({ secret, token: code, epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}

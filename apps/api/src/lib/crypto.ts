import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { env } from '../config/env.js';

// Identifiants publics non prévisibles (sans caractères ambigus)
export const publicId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 21);
const reportChars = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 4);

export function generateReportCode(): string {
  return `CMP-${reportChars()}-${reportChars()}`;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/** Code numérique à 6 chiffres — utilisé pour le PIN de session et l'OTP admin. */
export function generateNumericCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export const generatePin = generateNumericCode;
export const generateOtpCode = generateNumericCode;

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/** Jeton opaque pour le cookie "appareil de confiance" — seul son hash est stocké. */
export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** HMAC indexable pour retrouver une session à partir du PIN sans le stocker en clair. */
export function pinLookup(pin: string): string {
  return crypto.createHmac('sha256', env.PIN_PEPPER).update(pin).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

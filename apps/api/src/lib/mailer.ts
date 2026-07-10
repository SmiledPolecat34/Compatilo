import nodemailer from 'nodemailer';
import { env, isProd } from '../config/env.js';

/**
 * Sans configuration SMTP (développement), le code est journalisé au lieu
 * d'être envoyé — permet de tester le flux 2FA sans dépendance externe.
 */
const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendOtpEmail(to: string, code: string) {
  if (!transporter) {
    if (isProd) {
      console.error('SMTP non configuré : impossible d’envoyer le code OTP en production.');
    }
    console.log(`[DEV OTP] Code de connexion pour ${to} : ${code} (valide 5 minutes)`);
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Ton code de connexion Compatilo',
    text: `Ton code de connexion est : ${code}\nIl expire dans 5 minutes.\nSi tu n'es pas à l'origine de cette demande, ignore ce message.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto">
        <h2 style="color:#481f79">Ton code de connexion</h2>
        <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#241b35">${code}</p>
        <p style="color:#666">Ce code expire dans 5 minutes. Si tu n'es pas à l'origine de cette demande, ignore ce message.</p>
      </div>
    `,
  });
}

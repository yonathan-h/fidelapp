// thin wrapper around Resend's REST API -- a plain fetch call covers what's needed here,
// no reason to pull in their SDK as a dependency for two email templates

import { config } from "./config.js";

async function sendEmail({ to, subject, html }) {
  if (!config.resendApiKey) {
    console.warn(`RESEND_API_KEY not set -- skipping email to ${to} ("${subject}")`);
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.emailFrom, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function sendVerificationEmail(to, token) {
  const link = `${config.frontendUrl}/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: "Verify your Fidel account",
    html: `
      <p>Welcome to Fidel! Confirm your email to finish setting up your account.</p>
      <p><a href="${link}">Verify your email</a></p>
      <p>Or paste this link into your browser:<br>${link}</p>
      <p style="color:#888">This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const link = `${config.frontendUrl}/reset-password?token=${token}`;
  return sendEmail({
    to,
    subject: "Reset your Fidel password",
    html: `
      <p>Someone requested a password reset for this Fidel account. If that wasn't you, you can ignore this email -- your password hasn't changed.</p>
      <p><a href="${link}">Reset your password</a></p>
      <p>Or paste this link into your browser:<br>${link}</p>
      <p style="color:#888">This link expires in 1 hour.</p>
    `,
  });
}

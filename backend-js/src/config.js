// app config, pulled from env vars so it works the same locally and on render

import dotenv from "dotenv";
dotenv.config();

// fail fast and loud instead of silently falling back to an insecure default --
// a hardcoded SECRET_KEY fallback would mean anyone who reads this source (it's
// public) can forge a valid JWT for any user if the real env var is ever unset
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Set it in backend-js/.env (see .env.example).`);
  }
  return value;
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  secretKey: requireEnv("SECRET_KEY"),
  accessTokenExpiresIn: "7d",
  port: process.env.PORT || 8000,
  // email sending degrades gracefully (logs + skips) instead of requireEnv-failing startup
  // when unset -- verification/reset emails are an enhancement, not core to auth working
  resendApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || "onboarding@resend.dev",
  // used to build links inside emails (e.g. "https://your-app.vercel.app/verify-email?token=...")
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

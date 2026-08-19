// app config, pulled from env vars so it works the same locally and on render

import dotenv from "dotenv";
dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fidel_app",
  secretKey: process.env.SECRET_KEY || "dev-only-not-a-real-secret-change-me", // override this in prod
  accessTokenExpiresIn: "7d",
  port: process.env.PORT || 8000,
};

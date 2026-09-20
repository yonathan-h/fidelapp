import { Sequelize } from "sequelize";
import { config } from "./config.js";

// hosted Postgres (Neon, in production) requires SSL; a local dev Postgres typically isn't
// configured for it at all, so this is opt-in based on the connection string rather than
// always-on -- keeps `npm run dev` against a plain local install working with no extra setup
const isLocalDb = /localhost|127\.0\.0\.1/.test(config.databaseUrl);

export const sequelize = new Sequelize(config.databaseUrl, {
  logging: false, // flip to console.log when debugging queries
  dialectOptions: isLocalDb ? {} : { ssl: { require: true, rejectUnauthorized: false } },
});

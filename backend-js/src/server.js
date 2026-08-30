import express from "express";
import cors from "cors";
import { sequelize } from "./database.js";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { practiceRouter } from "./routes/practice.js";
import { requireAuth } from "./middleware/requireAuth.js";

// need these imported before sync() so sequelize knows about them
import "./models/User.js";
import "./models/Attempt.js";

const app = express();

app.use(express.json());

// CORS_ORIGINS is a comma-separated list, so the deployed frontend's origin can be added
// via an env var on the host instead of a code change -- see .env.example
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use("/auth", authRouter);
app.use("/practice", practiceRouter);

app.get("/health", async (req, res) => {
  try {
    await sequelize.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", detail: err.message });
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    email_verified: req.user.emailVerified,
  });
});

// catch-all so a bad query somewhere doesn't take down the whole process
process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection:", reason);
});

async function start() {
  // alter:true so newly-added model columns (e.g. email_verified, verification_token)
  // actually get created on an existing database instead of only on a fresh one --
  // this app has no migration framework, sync() is the whole schema story
  await sequelize.sync({ alter: true });
  app.listen(config.port, () => {
    console.log(`fidel backend listening on port ${config.port}`);
  });
}

start();

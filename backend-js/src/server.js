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

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      // add render frontend url here before deploy
    ],
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
  res.json({ id: req.user.id, username: req.user.username, email: req.user.email });
});

// catch-all so a bad query somewhere doesn't take down the whole process
process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection:", reason);
});

async function start() {
  await sequelize.sync();
  app.listen(config.port, () => {
    console.log(`fidel backend listening on port ${config.port}`);
  });
}

start();

import express from "express";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword, createAccessToken } from "../auth.js";

export const authRouter = express.Router();

// login: 10 attempts per 15 min per ip -- tight, since this is the brute force target
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many login attempts. Please try again later." },
});

// signup: looser, just to stop spam/scripted account creation
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many signup attempts. Please try again later." },
});

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

authRouter.post("/signup", signupLimiter, async (req, res) => {
  const { username, email, password } = req.body;

  if (!isValidUsername(username)) {
    return res.status(422).json({
      detail: [{ msg: "Username must be 3-20 characters: letters, numbers, and underscores only." }],
    });
  }
  if (!isValidEmail(email)) {
    return res.status(422).json({ detail: [{ msg: "Invalid email address." }] });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(422).json({
      detail: [{ msg: "Value error, Password must be at least 8 characters long" }],
    });
  }

  try {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ detail: "An account with this email already exists." });
    }
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ detail: "That username is already taken." });
    }

    const user = await User.create({
      username,
      email,
      hashedPassword: hashPassword(password),
    });

    return res.status(201).json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    // without this a db error here just hangs the request forever, no response at all
    console.error("signup error:", err);
    return res.status(500).json({ detail: "Signup failed. Please try again." });
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const invalidCredentials = () => res.status(401).json({ detail: "Incorrect email or password." });

  if (typeof email !== "string" || typeof password !== "string") {
    return invalidCredentials();
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return invalidCredentials();
    }
    if (!verifyPassword(password, user.hashedPassword)) {
      return invalidCredentials();
    }

    const token = createAccessToken(user.email);
    return res.json({ access_token: token, token_type: "bearer" });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ detail: "Login failed. Please try again." });
  }
});
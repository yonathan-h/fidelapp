import express from "express";
import rateLimit from "express-rate-limit";
import { Op } from "sequelize";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword, createAccessToken, generateToken } from "../auth.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../email.js";

export const authRouter = express.Router();

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h, shorter since a leaked reset token is more sensitive

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

// these two send an email per request -- tighter limit than signup so they can't be
// used to spam an arbitrary inbox
const emailActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many requests. Please try again later." },
});

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
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
  if (!isValidPassword(password)) {
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

    const verificationToken = generateToken();
    const user = await User.create({
      username,
      email,
      hashedPassword: hashPassword(password),
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });

    // don't fail signup over an email provider hiccup -- the account is already created,
    // and resend-verification exists for exactly this case
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (err) {
      console.error("failed to send verification email:", err);
    }

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

    // unverified users can still log in -- verification confirms email ownership (needed
    // for password reset to be meaningful) but isn't a hard gate on using the app
    const token = createAccessToken(user.email);
    return res.json({ access_token: token, token_type: "bearer" });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ detail: "Login failed. Please try again." });
  }
});

authRouter.post("/verify-email", async (req, res) => {
  const { token } = req.body;
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ detail: "Missing verification token." });
  }

  try {
    const user = await User.findOne({ where: { verificationToken: token } });
    if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      return res.status(400).json({ detail: "This verification link is invalid or has expired." });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    return res.json({ verified: true });
  } catch (err) {
    console.error("verify-email error:", err);
    return res.status(500).json({ detail: "Verification failed. Please try again." });
  }
});

authRouter.post("/resend-verification", emailActionLimiter, async (req, res) => {
  const { email } = req.body;
  // same response either way -- confirming/denying an account exists for a given email
  // is a user-enumeration leak, same reasoning as login's generic error message
  const genericResponse = () => res.json({ message: "If that account needs verifying, we've sent a new email." });

  if (!isValidEmail(email)) {
    return genericResponse();
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user || user.emailVerified) {
      return genericResponse();
    }

    const verificationToken = generateToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await user.save();

    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (err) {
      console.error("failed to send verification email:", err);
    }

    return genericResponse();
  } catch (err) {
    console.error("resend-verification error:", err);
    return genericResponse();
  }
});

authRouter.post("/forgot-password", emailActionLimiter, async (req, res) => {
  const { email } = req.body;
  const genericResponse = () => res.json({ message: "If that account exists, we've sent a password reset email." });

  if (!isValidEmail(email)) {
    return genericResponse();
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return genericResponse();
    }

    const resetToken = generateToken();
    user.resetToken = resetToken;
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (err) {
      console.error("failed to send password reset email:", err);
    }

    return genericResponse();
  } catch (err) {
    console.error("forgot-password error:", err);
    return genericResponse();
  }
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (typeof token !== "string" || !token) {
    return res.status(400).json({ detail: "Missing reset token." });
  }
  if (!isValidPassword(password)) {
    return res.status(422).json({ detail: [{ msg: "Value error, Password must be at least 8 characters long" }] });
  }

  try {
    const user = await User.findOne({ where: { resetToken: token, resetTokenExpires: { [Op.gt]: new Date() } } });
    if (!user) {
      return res.status(400).json({ detail: "This reset link is invalid or has expired." });
    }

    user.hashedPassword = hashPassword(password);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    return res.json({ reset: true });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ detail: "Password reset failed. Please try again." });
  }
});

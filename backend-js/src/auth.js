// password hashing + jwt handling
// using bcryptjs instead of native bcrypt -- native package failed to compile here (missing build headers),
// bcryptjs is pure js so no native binary to worry about on deploy either

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { config } from "./config.js";

const SALT_ROUNDS = 10;

export function hashPassword(plainPassword) {
  // bcrypt caps at 72 bytes, truncate so long passwords don't throw
  const truncated = Buffer.from(plainPassword, "utf-8").subarray(0, 72).toString("utf-8");
  return bcrypt.hashSync(truncated, SALT_ROUNDS);
}

export function verifyPassword(plainPassword, hashedPassword) {
  const truncated = Buffer.from(plainPassword, "utf-8").subarray(0, 72).toString("utf-8");
  return bcrypt.compareSync(truncated, hashedPassword);
}

export function createAccessToken(subject) {
  return jwt.sign({ sub: subject }, config.secretKey, {
    algorithm: "HS256",
    expiresIn: config.accessTokenExpiresIn,
  });
}

export function decodeAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.secretKey, { algorithms: ["HS256"] });
    return payload.sub;
  } catch {
    // expired, malformed, bad signature -- all just mean "not authenticated"
    return null;
  }
}

// for email-verification and password-reset links -- 32 random bytes as hex, not a JWT,
// since these need to be invalidated by clearing a DB column (a stateless JWT can't be
// revoked before its own expiry)
export function generateToken() {
  return randomBytes(32).toString("hex");
}

// extracts the jwt, looks up the user, attaches it to req.user
// use as middleware on any route that needs an authenticated user

import { decodeAccessToken } from "../auth.js";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Could not validate credentials." });
  }

  const token = authHeader.slice("Bearer ".length);
  const email = decodeAccessToken(token);

  if (!email) {
    return res.status(401).json({ detail: "Could not validate credentials." });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ detail: "Could not validate credentials." });
  }

  req.user = user;
  next();
}

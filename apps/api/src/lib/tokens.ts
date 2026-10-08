import jwt from "jsonwebtoken";
import type { Role } from "@kalndlord/shared";

export interface TokenPayload {
  sub: string;
  role: Role;
}

const EXPIRES_IN = "7d";

export function signToken(secret: string, payload: TokenPayload): string {
  return jwt.sign(payload, secret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(secret: string, token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string" || !decoded.sub || !decoded.role) return null;
    return { sub: decoded.sub, role: decoded.role as Role };
  } catch {
    return null;
  }
}

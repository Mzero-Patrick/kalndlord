import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import type { Role } from "@kalndlord/shared";
import { verifyToken } from "../lib/tokens";
import { sendError } from "../lib/http";
import { isVerified } from "../lib/users";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Loads the user from the bearer token on every request, so a role change or
// deleted account takes effect immediately.
export function requireAuth(prisma: PrismaClient, secret: string, roles?: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? verifyToken(secret, token) : null;
    if (!payload) return sendError(res, 401, "Please log in");

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !isVerified(user)) return sendError(res, 401, "Please log in");
    if (roles && !roles.includes(user.role)) return sendError(res, 403, "You don't have access to this page");

    req.user = user;
    next();
  };
}

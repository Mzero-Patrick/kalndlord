import { Router } from "express";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import {
  loginSchema,
  normalizeRwandaPhone,
  registerSchema,
  resendSchema,
  verifySchema,
  type AuthResponse,
  type RegisterResponse,
} from "@kalndlord/shared";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { checkCode, issueCode, maskDestination, RESEND_COOLDOWN_MS } from "../lib/codes";
import { sendError, zodFields } from "../lib/http";
import { signToken } from "../lib/tokens";
import { isVerified, toPublicUser } from "../lib/users";
import { requireAuth } from "../middleware/auth";

const CHECK_MESSAGES = {
  invalid: "That code is not right. Check it and try again",
  expired: "That code has expired. Request a new one",
  too_many_attempts: "Too many wrong attempts. Request a new code",
  none: "No active code. Request a new one",
} as const;

export function authRouter(prisma: PrismaClient, notifier: Notifier, config: Config) {
  const router = Router();

  router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const { fullName, phone, email, password, role, verifyVia } = parsed.data;

    const taken: Record<string, string> = {};
    if (phone && (await prisma.user.findUnique({ where: { phone } })))
      taken.phone = "This phone number already has an account";
    if (email && (await prisma.user.findUnique({ where: { email } })))
      taken.email = "This email already has an account";
    if (Object.keys(taken).length) return sendError(res, 409, "Account already exists", taken);

    const user = await prisma.user.create({
      data: { fullName, phone, email, role, passwordHash: await bcrypt.hash(password, 12) },
    });
    const destination = (verifyVia === "PHONE" ? phone : email)!;
    await issueCode(prisma, notifier, user.id, verifyVia, destination);

    const body: RegisterResponse = {
      userId: user.id,
      channel: verifyVia,
      sentTo: maskDestination(verifyVia, destination),
    };
    res.status(201).json(body);
  });

  router.post("/verify", async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the code", zodFields(parsed.error));
    const { userId, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 404, "Account not found");

    const check = await checkCode(prisma, userId, code);
    if (check.result !== "ok") return sendError(res, 400, CHECK_MESSAGES[check.result], { code: CHECK_MESSAGES[check.result] });

    const verified = await prisma.user.update({
      where: { id: userId },
      data: check.channel === "PHONE" ? { phoneVerifiedAt: new Date() } : { emailVerifiedAt: new Date() },
    });
    const body: AuthResponse = {
      token: signToken(config.jwtSecret, { sub: verified.id, role: verified.role }),
      user: toPublicUser(verified),
    };
    res.json(body);
  });

  router.post("/resend", async (req, res) => {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Missing account");
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) return sendError(res, 404, "Account not found");
    if (isVerified(user)) return sendError(res, 400, "This account is already verified. Log in instead");

    const last = await prisma.verificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return sendError(res, 429, "Please wait a minute before requesting another code");
    }
    const channel = last?.channel ?? (user.phone ? "PHONE" : "EMAIL");
    const destination = (channel === "PHONE" ? user.phone : user.email)!;
    await issueCode(prisma, notifier, user.id, channel, destination);
    const body: RegisterResponse = { userId: user.id, channel, sentTo: maskDestination(channel, destination) };
    res.json(body);
  });

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const { identifier, password } = parsed.data;

    const phone = normalizeRwandaPhone(identifier);
    const user = phone
      ? await prisma.user.findUnique({ where: { phone } })
      : await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });

    // Same message whether the account or the password is wrong.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return sendError(res, 401, "Wrong phone/email or password");
    }
    if (!isVerified(user)) {
      return res.status(403).json({ error: "Verify your account first", needsVerification: true, userId: user.id });
    }
    const body: AuthResponse = {
      token: signToken(config.jwtSecret, { sub: user.id, role: user.role }),
      user: toPublicUser(user),
    };
    res.json(body);
  });

  router.get("/me", requireAuth(prisma, config.jwtSecret), (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  });

  return router;
}

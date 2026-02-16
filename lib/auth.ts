import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { localFindUserById } from "@/lib/auth-local";
import { db } from "@/lib/db";

const SESSION_COOKIE_NAME = "oi_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

type SessionPayload = {
  userId: string;
  exp: number;
};

export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  role: string;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV !== "production") {
    return "oi-dev-auth-secret-change-me";
  }

  throw new Error("AUTH_SECRET is not configured");
}

function toBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(input: string) {
  return createHmac("sha256", getAuthSecret()).update(input).digest("base64url");
}

function encodeSessionToken(payload: SessionPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, receivedSignature] = token.split(".");
  if (!encodedPayload || !receivedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!parsed.userId || !parsed.exp) {
      return null;
    }
    if (parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt?: string) {
  const targetSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, targetSalt, 64).toString("hex");
  return `scrypt:${targetSalt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algo, salt, hash] = passwordHash.split(":");
  if (algo !== "scrypt" || !salt || !hash) {
    return false;
  }
  const check = hashPassword(password, salt);
  const checkHash = check.split(":")[2];
  const received = Buffer.from(hash);
  const expected = Buffer.from(checkHash);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function createPasswordHash(password: string) {
  return hashPassword(password);
}

async function resolveAuthUserFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;

  const payload = decodeSessionToken(token);
  if (!payload) return null;

  const useLocalAuth = !process.env.DATABASE_URL;
  if (useLocalAuth) {
    const user = await localFindUserById(payload.userId);
    if (!user) return null;
    return { id: user.id, email: user.email, nickname: user.nickname, role: user.role };
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, nickname: true, role: true },
  });

  return user;
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  return resolveAuthUserFromToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return resolveAuthUserFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function requireAdmin(user: AuthUser | null): { ok: true } | { ok: false; error: string; status: number } {
  if (!user) {
    return { ok: false, error: "Authentication required", status: 401 };
  }
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Admin permission required", status: 403 };
  }
  return { ok: true };
}

export function requireUser(user: AuthUser | null): { ok: true } | { ok: false; error: string; status: number } {
  if (!user) {
    return { ok: false, error: "Authentication required", status: 401 };
  }
  return { ok: true };
}

export function applySessionCookie(response: NextResponse, userId: string) {
  const token = encodeSessionToken({
    userId,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

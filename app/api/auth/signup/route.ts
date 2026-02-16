import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie, createPasswordHash } from "@/lib/auth";
import { localCreateUser, localFindUserByEmail } from "@/lib/auth-local";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const nickname = String(body.nickname ?? "").trim();

  if (!email || !password) {
    return NextResponse.json({ ok: false, data: null, error: "email and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ ok: false, data: null, error: "password must be at least 8 chars" }, { status: 400 });
  }

  const useLocalAuth = !process.env.DATABASE_URL;

  if (useLocalAuth) {
    const exists = await localFindUserByEmail(email);
    if (exists) {
      return NextResponse.json({ ok: false, data: null, error: "email already exists" }, { status: 409 });
    }

    const user = await localCreateUser({
      email,
      nickname: nickname || email.split("@")[0],
      passwordHash: createPasswordHash(password),
    });

    const response = NextResponse.json(
      { ok: true, data: { id: user.id, email: user.email, nickname: user.nickname, role: user.role }, error: null },
      { status: 201 },
    );
    applySessionCookie(response, user.id);
    return response;
  }

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    return NextResponse.json({ ok: false, data: null, error: "email already exists" }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email,
      nickname: nickname || email.split("@")[0],
      passwordHash: createPasswordHash(password),
      role: "USER",
      pointBalance: 1000,
    },
    select: { id: true, email: true, nickname: true, role: true },
  });

  const response = NextResponse.json({ ok: true, data: user, error: null }, { status: 201 });
  applySessionCookie(response, user.id);
  return response;
}

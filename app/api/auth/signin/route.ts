import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ ok: false, data: null, error: "email and password are required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, nickname: true, role: true, passwordHash: true },
  });

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json(
    { ok: true, data: { id: user.id, email: user.email, nickname: user.nickname, role: user.role }, error: null },
    { status: 200 },
  );
  applySessionCookie(response, user.id);
  return response;
}

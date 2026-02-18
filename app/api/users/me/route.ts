import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { localFindUserById } from "@/lib/auth-local";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    const localUser = await localFindUserById(user!.id);

    if (!localUser) {
      return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: localUser.id,
        email: localUser.email,
        nickname: localUser.nickname,
        role: localUser.role,
        pointBalance: localUser.pointBalance,
      },
      error: null,
    });
  }

  const dbUser = await db.user.findUnique({
    where: { id: user!.id },
    select: {
      id: true,
      email: true,
      nickname: true,
      role: true,
      pointBalance: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: dbUser,
    error: null,
  });
}

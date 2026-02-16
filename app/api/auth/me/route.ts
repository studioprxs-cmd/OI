import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  return NextResponse.json({ ok: true, data: user, error: null });
}

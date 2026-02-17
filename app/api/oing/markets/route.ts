import { NextResponse } from "next/server";

import { getOingMarkets } from "@/lib/oing-market";

export async function GET() {
  const data = await getOingMarkets();
  return NextResponse.json({ ok: true, data, error: null });
}

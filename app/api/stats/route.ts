import { NextResponse } from "next/server";

import { fetchHomeFeedData } from "@/lib/home-feed";

export async function GET() {
  const { stats } = await fetchHomeFeedData();
  return NextResponse.json({ ok: true, data: stats, error: null });
}

import { NextResponse } from "next/server";

import { fetchHomeFeedData } from "@/lib/home-feed";

export async function GET() {
  const { trending } = await fetchHomeFeedData();
  return NextResponse.json({ ok: true, data: trending, error: null });
}

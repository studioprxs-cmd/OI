import { NextResponse } from "next/server";

import { fetchHomeFeedData } from "@/lib/home-feed";

export async function GET() {
  const { recentMembers } = await fetchHomeFeedData();
  return NextResponse.json({ ok: true, data: recentMembers, error: null });
}

import { NextRequest, NextResponse } from "next/server";

import { getMarketProducts } from "@/lib/market/catalog";

export async function GET(req: NextRequest) {
  const zoneParam = req.nextUrl.searchParams.get("zone");
  const activeParam = req.nextUrl.searchParams.get("active");

  const zone = zoneParam ? zoneParam.toUpperCase() : undefined;
  const activeOnly = activeParam === "true";

  const products = getMarketProducts({
    zone: zone === "GOODS" || zone === "DIGITAL" || zone === "DEAL" || zone === "GIFT" ? zone : undefined,
    activeOnly,
  });

  return NextResponse.json({
    ok: true,
    data: products,
    meta: {
      total: products.length,
      activeOnly,
    },
    error: null,
  });
}

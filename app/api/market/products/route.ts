import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { createMarketProduct, getMarketProducts } from "@/lib/market/catalog";

function parseStock(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

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

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const adminCheck = requireAdmin(user);
  if (!adminCheck.ok) {
    return NextResponse.json({ ok: false, error: adminCheck.error }, { status: adminCheck.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const zone = String(body.zone ?? "").toUpperCase();
  if (!(zone === "GOODS" || zone === "DIGITAL" || zone === "DEAL" || zone === "GIFT")) {
    return NextResponse.json({ ok: false, error: "Invalid zone" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim();
  const ctaLabel = String(body.ctaLabel ?? "").trim();
  const availableFrom = String(body.availableFrom ?? "").trim();
  const availableUntil = String(body.availableUntil ?? "").trim();
  const pricePoints = Number(body.pricePoints);
  const stock = parseStock(body.stock);
  const isActive = Boolean(body.isActive);

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ ok: false, error: "Name must be 2~60 chars" }, { status: 400 });
  }
  if (description.length < 4 || description.length > 280) {
    return NextResponse.json({ ok: false, error: "Description must be 4~280 chars" }, { status: 400 });
  }
  if (!Number.isFinite(pricePoints) || pricePoints < 100) {
    return NextResponse.json({ ok: false, error: "Price must be at least 100 points" }, { status: 400 });
  }

  const created = createMarketProduct({
    name,
    description,
    imageUrl: imageUrl || "/oi-logo-new.jpg",
    zone,
    pricePoints,
    stock,
    isActive,
    availableFrom: availableFrom || undefined,
    availableUntil: availableUntil || undefined,
    ctaLabel: ctaLabel || undefined,
  });

  return NextResponse.json({
    ok: true,
    data: created,
    error: null,
  }, { status: 201 });
}

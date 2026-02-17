import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  calculateMarketOrderPoints,
  reserveMarketProductStock,
  rollbackMarketProductStock,
} from "@/lib/market/catalog";

type CreateOrderBody = {
  productId?: string;
  quantity?: number;
};

const MAX_ORDER_QUANTITY = 20;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: "DB is not configured in local mode. market order write is disabled.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as CreateOrderBody;
  const productId = String(body.productId ?? "").trim();
  const quantity = Number(body.quantity ?? 1);

  if (!productId) {
    return NextResponse.json({ ok: false, data: null, error: "productId is required" }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
    return NextResponse.json(
      { ok: false, data: null, error: `quantity must be between 1 and ${MAX_ORDER_QUANTITY}` },
      { status: 400 },
    );
  }

  const reservationResult = reserveMarketProductStock(productId, quantity);

  if (!reservationResult.ok) {
    if (reservationResult.error === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Product not found" }, { status: 404 });
    }

    if (reservationResult.error === "PRODUCT_UNAVAILABLE") {
      return NextResponse.json({ ok: false, data: null, error: "Product is not currently available" }, { status: 409 });
    }

    return NextResponse.json({ ok: false, data: null, error: "Requested quantity exceeds available stock" }, { status: 409 });
  }

  const authUser = user!;
  const reservedProduct = reservationResult.product;
  const totalPoints = calculateMarketOrderPoints(reservedProduct.pricePoints, quantity);

  let result:
    | {
        ok: true;
        order: {
          id: string;
          productId: string;
          quantity: number;
          totalPoints: number;
          status: string;
        };
        balanceAfter: number;
      }
    | {
        ok: false;
        error: "INSUFFICIENT_POINTS";
        currentBalance: number;
      };

  try {
    result = await db.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, pointBalance: true },
      });

      if (!currentUser) {
        throw new Error("USER_NOT_FOUND");
      }

      if (currentUser.pointBalance < totalPoints) {
        return {
          ok: false as const,
          error: "INSUFFICIENT_POINTS",
          currentBalance: currentUser.pointBalance,
        };
      }

      const updated = await tx.user.update({
        where: { id: authUser.id },
        data: { pointBalance: { decrement: totalPoints } },
        select: { pointBalance: true },
      });

      const orderRef = `market:${reservedProduct.id}:${Date.now()}`;

      await tx.walletTransaction.create({
        data: {
          userId: authUser.id,
          type: "MARKET_PURCHASE",
          amount: -totalPoints,
          balanceAfter: updated.pointBalance,
          note: `Market order ${orderRef} qty:${quantity}`,
        },
      });

      return {
        ok: true as const,
        order: {
          id: orderRef,
          productId: reservedProduct.id,
          quantity,
          totalPoints,
          status: "COMPLETED",
        },
        balanceAfter: updated.pointBalance,
      };
    });
  } catch (error) {
    rollbackMarketProductStock(reservationResult.reservation);
    throw error;
  }

  if (!result.ok) {
    rollbackMarketProductStock(reservationResult.reservation);

    return NextResponse.json(
      {
        ok: false,
        data: {
          required: totalPoints,
          current: result.currentBalance,
        },
        error: result.error,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        ...result.order,
        product: {
          id: reservedProduct.id,
          name: reservedProduct.name,
          zone: reservedProduct.zone,
        },
        balanceAfter: result.balanceAfter,
        remainingStock: reservedProduct.stock,
      },
      error: null,
    },
    { status: 201 },
  );
}

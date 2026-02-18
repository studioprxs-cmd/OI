import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  calculateMarketOrderPoints,
  reserveMarketProductStock,
  rollbackMarketProductStock,
} from "@/lib/market/catalog";
import { applyWalletDelta } from "@/lib/wallet";

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

      const orderRef = `market:${reservedProduct.id}:${Date.now()}`;

      const wallet = await applyWalletDelta({
        tx,
        userId: authUser.id,
        amount: -totalPoints,
        type: "MARKET_PURCHASE",
        note: `Market order ${orderRef} qty:${quantity}`,
      }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "WALLET_FAILURE";

        if (message === "WALLET_USER_NOT_FOUND") {
          throw new Error("USER_NOT_FOUND");
        }

        if (message === "WALLET_INSUFFICIENT_BALANCE") {
          const latestUser = await tx.user.findUnique({
            where: { id: authUser.id },
            select: { pointBalance: true },
          });

          return {
            insufficient: true as const,
            currentBalance: latestUser?.pointBalance ?? 0,
          };
        }

        throw error;
      });

      if (wallet && "insufficient" in wallet) {
        return {
          ok: false as const,
          error: "INSUFFICIENT_POINTS",
          currentBalance: wallet.currentBalance,
        };
      }

      return {
        ok: true as const,
        order: {
          id: orderRef,
          productId: reservedProduct.id,
          quantity,
          totalPoints,
          status: "COMPLETED",
        },
        balanceAfter: wallet.balanceAfter,
      };
    });
  } catch (error) {
    rollbackMarketProductStock(reservationResult.reservation);

    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "USER_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
    }

    if (message === "WALLET_BALANCE_WRITE_RACE") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "포인트 차감 반영 중 동시성 충돌이 발생했습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 409 },
      );
    }

    if (message === "WALLET_TX_DUPLICATE_REFERENCE") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "중복된 마켓 결제 원장 참조가 감지되어 주문을 중단했습니다.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to create market order" }, { status: 500 });
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

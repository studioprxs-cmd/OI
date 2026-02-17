import { ReportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { LocalReportStatus, localListReports, localUpdateReportStatus } from "@/lib/report-local";

const ALLOWED_STATUSES: Array<ReportStatus | "ALL"> = ["ALL", "OPEN", "REVIEWING", "CLOSED", "REJECTED"];
const ALLOWED_BULK_INPUT_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING"];
const ALLOWED_BULK_TARGET_STATUSES: ReportStatus[] = ["REVIEWING", "CLOSED", "REJECTED"];
const MAX_BULK_IDS = 150;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(req.url);
  const rawStatus = String(searchParams.get("status") ?? "ALL").toUpperCase() as ReportStatus | "ALL";
  const status = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : "ALL";

  if (!process.env.DATABASE_URL) {
    const reports = await localListReports(status === "ALL" ? undefined : (status as LocalReportStatus));
    return NextResponse.json({ ok: true, data: reports, error: null });
  }

  const reports = await db.report.findMany({
    where: status === "ALL" ? undefined : { status: status as ReportStatus },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, nickname: true, email: true } },
      topic: { select: { id: true, title: true } },
      comment: { select: { id: true, content: true, isHidden: true } },
    },
    take: 200,
  });

  return NextResponse.json({ ok: true, data: reports, error: null });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => null) as { ids?: unknown; status?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? Array.from(new Set(body?.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
    : [];
  const status = String(body?.status ?? "").toUpperCase() as ReportStatus;

  if (!ALLOWED_BULK_TARGET_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid status" }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, data: null, error: "ids is required" }, { status: 400 });
  }

  if (ids.length > MAX_BULK_IDS) {
    return NextResponse.json({ ok: false, data: null, error: `최대 ${MAX_BULK_IDS}건까지 한 번에 처리할 수 있습니다.` }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    let successCount = 0;

    for (const id of ids) {
      const report = await localUpdateReportStatus({
        id,
        status: status as LocalReportStatus,
        commentVisibility: "KEEP",
      });
      if (report) successCount += 1;
    }

    return NextResponse.json({
      ok: true,
      data: {
        targetCount: ids.length,
        successCount,
        skipCount: ids.length - successCount,
        updatedIds: [],
      },
      error: null,
    });
  }

  const reportRows = await db.report.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  });

  const targetIdSet = new Set(ids);
  const foundIdSet = new Set(reportRows.map((row) => row.id));
  const missingCount = ids.filter((id) => !foundIdSet.has(id)).length;

  const actionableIds = reportRows
    .filter((row) => ALLOWED_BULK_INPUT_STATUSES.includes(row.status))
    .map((row) => row.id);

  let updatedIds: string[] = [];

  if (actionableIds.length > 0) {
    await db.report.updateMany({
      where: { id: { in: actionableIds } },
      data: {
        status,
        reviewedAt: new Date(),
      },
    });

    updatedIds = actionableIds;
  }

  const skipCount = Math.max(0, targetIdSet.size - updatedIds.length);
  const lockedSkipCount = Math.max(0, skipCount - missingCount);

  return NextResponse.json({
    ok: true,
    data: {
      targetCount: ids.length,
      successCount: updatedIds.length,
      skipCount,
      missingCount,
      lockedSkipCount,
      updatedIds,
    },
    error: null,
  });
}

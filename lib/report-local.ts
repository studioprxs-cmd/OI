import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type LocalReportStatus = "OPEN" | "REVIEWING" | "CLOSED" | "REJECTED";

export type LocalReport = {
  id: string;
  reporterId: string;
  topicId: string | null;
  commentId: string | null;
  reason: string;
  detail: string | null;
  status: LocalReportStatus;
  createdAt: string;
  reviewedAt: string | null;
};

type LocalReportData = {
  reports: LocalReport[];
  hiddenCommentIds: string[];
};

type LocalCommentVisibility = "KEEP" | "HIDE" | "UNHIDE";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "reports.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: LocalReportData = { reports: [], hiddenCommentIds: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readData(): Promise<LocalReportData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as LocalReportData;
    return {
      reports: parsed.reports ?? [],
      hiddenCommentIds: parsed.hiddenCommentIds ?? [],
    };
  } catch {
    return { reports: [], hiddenCommentIds: [] };
  }
}

async function writeData(data: LocalReportData) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function localCreateReport(input: {
  reporterId: string;
  topicId?: string | null;
  commentId?: string | null;
  reason: string;
  detail?: string | null;
}) {
  const data = await readData();
  const report: LocalReport = {
    id: randomUUID(),
    reporterId: input.reporterId,
    topicId: input.topicId ?? null,
    commentId: input.commentId ?? null,
    reason: input.reason,
    detail: input.detail ?? null,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  data.reports.unshift(report);
  await writeData(data);
  return report;
}

export async function localListReports(status?: LocalReportStatus) {
  const data = await readData();
  return data.reports.filter((report) => (status ? report.status === status : true));
}

function isActiveReportStatus(status: LocalReportStatus) {
  return status === "OPEN" || status === "REVIEWING";
}

export async function localHasActiveCommentReport(input: {
  reporterId: string;
  commentId: string;
}) {
  const data = await readData();
  return data.reports.some(
    (report) =>
      report.reporterId === input.reporterId
      && report.commentId === input.commentId
      && isActiveReportStatus(report.status),
  );
}

export async function localHasActiveTopicReport(input: {
  reporterId: string;
  topicId: string;
}) {
  const data = await readData();
  return data.reports.some(
    (report) =>
      report.reporterId === input.reporterId
      && report.topicId === input.topicId
      && report.commentId === null
      && isActiveReportStatus(report.status),
  );
}

export async function localUpdateReportStatus(input: {
  id: string;
  status: LocalReportStatus;
  commentVisibility?: LocalCommentVisibility;
}) {
  const data = await readData();
  const report = data.reports.find((item) => item.id === input.id);
  if (!report) return null;

  report.status = input.status;
  report.reviewedAt = new Date().toISOString();

  if (report.commentId) {
    if (input.commentVisibility === "HIDE" && !data.hiddenCommentIds.includes(report.commentId)) {
      data.hiddenCommentIds.push(report.commentId);
    }

    if (input.commentVisibility === "UNHIDE") {
      data.hiddenCommentIds = data.hiddenCommentIds.filter((id) => id !== report.commentId);
    }
  }

  await writeData(data);
  return report;
}

export async function localDeleteReport(input: { id: string; reporterId: string }) {
  const data = await readData();
  const index = data.reports.findIndex((item) => item.id === input.id);
  if (index < 0) return null;

  const report = data.reports[index];
  if (report.reporterId !== input.reporterId) {
    return null;
  }

  if (!isActiveReportStatus(report.status)) {
    return { ok: false as const, reason: "NOT_ACTIONABLE" as const };
  }

  data.reports.splice(index, 1);
  await writeData(data);

  return { ok: true as const, report };
}

export async function localIsCommentHidden(commentId: string) {
  const data = await readData();
  return data.hiddenCommentIds.includes(commentId);
}

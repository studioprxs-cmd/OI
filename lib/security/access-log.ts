import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type AuthAccessAction = "SIGNIN_SUCCESS" | "SIGNUP_SUCCESS";

export type AuthAccessEvent = {
  id: string;
  userId: string;
  email: string;
  action: AuthAccessAction;
  ip: string;
  userAgent: string;
  createdAt: string;
};

type AuthAccessLog = {
  events: AuthAccessEvent[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const LOG_FILE = path.join(DATA_DIR, "auth-access-log.json");

async function ensureLogFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(LOG_FILE);
  } catch {
    const initial: AuthAccessLog = { events: [] };
    await fs.writeFile(LOG_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readLog(): Promise<AuthAccessLog> {
  await ensureLogFile();
  const raw = await fs.readFile(LOG_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as AuthAccessLog;
    return { events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch {
    return { events: [] };
  }
}

async function writeLog(log: AuthAccessLog) {
  await ensureLogFile();
  await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), "utf8");
}

export function resolveRequestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const candidates = [
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("x-client-ip"),
  ];

  return candidates.find((value) => Boolean(value && value.trim()))?.trim() ?? "unknown";
}

export async function recordAuthAccessEvent(input: {
  userId: string;
  email: string;
  action: AuthAccessAction;
  ip: string;
  userAgent?: string | null;
}) {
  const log = await readLog();
  const event: AuthAccessEvent = {
    id: randomUUID(),
    userId: input.userId,
    email: input.email,
    action: input.action,
    ip: input.ip || "unknown",
    userAgent: input.userAgent?.trim() || "unknown",
    createdAt: new Date().toISOString(),
  };

  const nextEvents = [...log.events, event].slice(-5000);
  await writeLog({ events: nextEvents });

  return event;
}

export async function getSuspiciousMultiAccountIps(windowDays = 7, minUsers = 3) {
  const log = await readLog();
  const cutoff = Date.now() - Math.max(1, windowDays) * 24 * 60 * 60 * 1000;

  const bucket = new Map<string, { users: Set<string>; emails: Set<string>; lastSeenAt: number; events: number }>();

  for (const event of log.events) {
    const ts = new Date(event.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (!event.ip || event.ip === "unknown") continue;

    const current = bucket.get(event.ip) ?? {
      users: new Set<string>(),
      emails: new Set<string>(),
      lastSeenAt: ts,
      events: 0,
    };

    current.users.add(event.userId);
    current.emails.add(event.email);
    current.lastSeenAt = Math.max(current.lastSeenAt, ts);
    current.events += 1;
    bucket.set(event.ip, current);
  }

  return Array.from(bucket.entries())
    .map(([ip, value]) => ({
      ip,
      userCount: value.users.size,
      users: Array.from(value.users),
      emails: Array.from(value.emails),
      events: value.events,
      lastSeenAt: new Date(value.lastSeenAt).toISOString(),
    }))
    .filter((item) => item.userCount >= Math.max(2, minUsers))
    .sort((a, b) => {
      if (b.userCount !== a.userCount) return b.userCount - a.userCount;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });
}

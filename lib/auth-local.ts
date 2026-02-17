import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

type LocalUser = {
  id: string;
  email: string;
  nickname: string;
  role: string;
  passwordHash: string;
  pointBalance: number;
  createdAt: string;
};

type LocalAuthData = {
  users: LocalUser[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "auth-users.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: LocalAuthData = { users: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readData(): Promise<LocalAuthData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as LocalAuthData;
    return { users: parsed.users ?? [] };
  } catch {
    return { users: [] };
  }
}

async function writeData(data: LocalAuthData) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function localFindUserByEmail(email: string) {
  const data = await readData();
  return data.users.find((u) => u.email === email) ?? null;
}

export async function localFindUserById(id: string) {
  const data = await readData();
  return data.users.find((u) => u.id === id) ?? null;
}

export async function localCreateUser(input: { email: string; nickname: string; passwordHash: string; initialPoints?: number }) {
  const data = await readData();
  const initialPoints = Number.isFinite(input.initialPoints)
    ? Math.max(0, Math.floor(input.initialPoints ?? 0))
    : 1000;

  const user: LocalUser = {
    id: randomUUID(),
    email: input.email,
    nickname: input.nickname,
    role: "USER",
    passwordHash: input.passwordHash,
    pointBalance: initialPoints,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  await writeData(data);
  return user;
}

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __oiPrisma: PrismaClient | undefined;
}

export const db =
  global.__oiPrisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__oiPrisma = db;
}

import { PrismaClient } from "@prisma/client";

// TEMPORARY DIAGNOSTIC - remove once DATABASE_URL is confirmed reaching the
// deployed runtime. Logs only key names, never values.
console.log("DIAG_ENV_KEYS:", JSON.stringify(Object.keys(process.env).sort()));
console.log("DIAG_HAS_DATABASE_URL:", typeof process.env.DATABASE_URL !== "undefined");
console.log("DIAG_HAS_SESSION_SECRET:", typeof process.env.SESSION_SECRET !== "undefined");

// Standard Next.js dev-mode singleton so hot-reload doesn't exhaust
// SQLite connections by creating a new PrismaClient on every reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

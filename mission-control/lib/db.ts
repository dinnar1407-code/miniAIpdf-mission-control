import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 生产环境只记录错误，避免把每条 SQL 都打进 Vercel 日志（既是噪音，也可能泄露数据）
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

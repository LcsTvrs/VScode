import { PrismaClient } from "@prisma/client";
import { databaseEnvironment } from "./database-environment";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const env = databaseEnvironment(process.env);
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

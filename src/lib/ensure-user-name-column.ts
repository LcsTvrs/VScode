import { prisma } from "@/lib/prisma";

let migration: Promise<unknown> | undefined;

// Applies the additive column on the first authenticated request when the
// production database credentials are available only to the Vercel runtime.
export async function ensureUserNameColumn() {
  migration ??= prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT');
  try {
    await migration;
  } catch (error) {
    migration = undefined;
    throw error;
  }
}

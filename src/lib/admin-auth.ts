import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSession, type AdminSession } from "@/lib/admin-session";

export async function getCurrentAdminSession(token: string | undefined): Promise<AdminSession | null> {
  const session = await verifyAdminSession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { login: true, role: true, storeId: true, mustChangePassword: true, updatedAt: true },
  });
  if (
    !user ||
    user.login !== session.login ||
    user.role !== session.role ||
    user.storeId !== session.storeId ||
    user.mustChangePassword !== session.mustChangePassword ||
    user.updatedAt.getTime() !== session.userUpdatedAt
  ) return null;
  return session;
}

export async function getRequestAdminSession(request: Request) {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  return getCurrentAdminSession(cookie?.slice(ADMIN_SESSION_COOKIE.length + 1));
}

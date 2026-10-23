import { readJsonBody } from "@/lib/json-body";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getRequestSignedAdminSession } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE, createAdminSession, sessionCookieOptions, type AdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { validNewPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export const runtime = "nodejs";

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function successResponse(session: AdminSession) {
  const token = await createAdminSession(session);
  const response = json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export async function POST(request: Request) {
  try {
    const session = await getRequestSignedAdminSession(request);
    if (!session) return json({ message: "Sessão inválida. Entre novamente com sua senha temporária ou, se a troca já foi salva, com a nova senha." }, 401);

    const body = await readJsonBody(request);
    const password = body?.novaSenha;
    if (!validNewPassword(password)) return json({ message: PASSWORD_POLICY_MESSAGE }, 400);

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.login !== session.login || user.role !== session.role || user.storeId !== session.storeId) {
      return json({ message: "O acesso foi alterado. Entre novamente antes de trocar a senha." }, 401);
    }

    if (!user.mustChangePassword) {
      // Recover a saved change whose response/cookie was lost. The old signed
      // token alone is insufficient: require the saved new password as well.
      const recoverable = session.mustChangePassword
        ? user.updatedAt.getTime() > session.userUpdatedAt
        : user.updatedAt.getTime() === session.userUpdatedAt;
      if (recoverable && await bcrypt.compare(password, user.passwordHash)) {
        return await successResponse({ ...session, mustChangePassword: false, userUpdatedAt: user.updatedAt.getTime() });
      }
      return json({ message: "A senha já foi alterada. Entre novamente com a nova senha." }, 409);
    }

    if (!session.mustChangePassword || user.updatedAt.getTime() !== session.userUpdatedAt) {
      return json({ message: "O acesso foi alterado. Entre novamente antes de trocar a senha." }, 409);
    }
    if (await bcrypt.compare(password, user.passwordHash)) {
      return json({ message: "Escolha uma senha diferente da atual." }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updatedAt = new Date(Math.max(Date.now(), user.updatedAt.getTime() + 1));
    // Prepare the session and cookie before writing, so a signing failure leaves
    // the temporary password and pending session available for another attempt.
    const response = await successResponse({ ...session, mustChangePassword: false, userUpdatedAt: updatedAt.getTime() });
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, updatedAt: user.updatedAt, mustChangePassword: true },
      data: { passwordHash, mustChangePassword: false, updatedAt },
    });
    if (claimed.count !== 1) return json({ message: "O acesso foi alterado por outra operação. Entre novamente." }, 409);
    return response;
  } catch {
    return json({ message: "Não foi possível concluir a troca agora. Tente novamente com a mesma nova senha. Não é necessário solicitar outro reset." }, 503);
  }
}

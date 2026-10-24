import { changeAdminPassword } from "@/features/auth/server/change-password";
import { readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

// Keep older clients working; both entry points use the same validation.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return changeAdminPassword(request, body?.novaSenha);
}

export async function PATCH(request: Request) {
  const body = await readJsonBody(request);
  return changeAdminPassword(request, body?.novaSenha);
}

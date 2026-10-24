import { requireAdmin } from "./authorization";

export function requireMasterAdmin(request: Request) {
  return requireAdmin(request, {
    role: "MASTER_ADMIN",
    forbiddenMessage: "Apenas MASTER_ADMIN pode executar esta ação.",
    passwordMessage: "Apenas MASTER_ADMIN pode executar esta ação.",
  });
}

import { getCurrentAdminSession } from "@/features/auth/server/session";
import { ADMIN_SESSION_COOKIE } from "@/features/auth/session";
import { cookies } from "next/headers";
import { AdminNavigation } from "@/components/admin-navigation";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = await getCurrentAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  return (
    <>
      {session && !session.mustChangePassword ? (
        <header className="admin-header">
          <AdminNavigation master={session.role === "MASTER_ADMIN"} />
          <p className="admin-session" aria-label="Sessão atual">
            Logado como: <strong className="text-[var(--ink)]">{session.name}</strong>
            <span className="mx-2">|</span>
            Perfil: <strong className="text-[var(--green-dark)]">{session.role === "MASTER_ADMIN" ? "Administrador geral" : "Gestor da loja"}</strong>
          </p>
        </header>
      ) : null}
      {children}
    </>
  );
}

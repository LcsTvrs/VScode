import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = await getCurrentAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  return (
    <>
      {session ? (
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-white px-5 py-3 sm:px-8">
          <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Administração">
            <Link className="rounded px-3 py-2 text-[var(--ink)] hover:bg-[var(--green-pale)]" href="/">Painel</Link>
            {session.role === "MASTER_ADMIN" ? (
              <>
                <Link className="rounded px-3 py-2 text-[var(--ink)] hover:bg-[var(--green-pale)]" href="/admin/lojas">Lojas</Link>
                <Link className="rounded px-3 py-2 text-[var(--ink)] hover:bg-[var(--green-pale)]" href="/admin/usuarios">Utilizadores</Link>
              </>
            ) : null}
          </nav>
          <p className="m-0 text-xs text-[var(--muted)]" aria-label="Sessão atual">
            Logado como: <strong className="text-[var(--ink)]">{session.login}</strong>
            <span className="mx-2">|</span>
            Perfil: <strong className="text-[var(--green-dark)]">{session.role}</strong>
          </p>
        </header>
      ) : null}
      {children}
    </>
  );
}

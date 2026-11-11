"use client";

import { ArrowUpRight, Building2, LayoutDashboard, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavigation({ master }: { master: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Painel", icon: LayoutDashboard },
    ...(master ? [{ href: "/admin/lojas", label: "Lojas", icon: Building2 }, { href: "/admin/usuarios", label: "Usuários", icon: UsersRound }] : []),
  ];
  return <div className="admin-navigation">
    <Link href="/" className="admin-brand"><Image src="/leroy-merlin.svg" alt="Leroy Merlin" width={66} height={40} /><span>Gestão de uniformes<small>ADMINISTRAÇÃO</small></span></Link>
    <nav aria-label="Administração">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}><Icon size={17} />{label}</Link>)}</nav>
    <Link href="/solicitar" className="admin-public-link">Área de solicitação <ArrowUpRight size={16} /></Link>
  </div>;
}

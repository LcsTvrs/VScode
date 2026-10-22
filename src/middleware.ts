import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if ((origin !== null && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ message: "Origem da requisição não permitida." }, { status: 403 });
    }
  }
  const publicPath = pathname === "/admin/login" || pathname === "/api/auth/login" || pathname === "/api/setup" || pathname === "/api/requests/public";
  const publicImage = request.method === "GET" && /^\/api\/uniform-images\/[^/]+$/.test(pathname);
  if (publicPath || publicImage) return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Autenticação administrativa necessária." }, { status: 401 });
  }
  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const passwordChangeAllowed = pathname === "/admin/trocar-senha" || pathname === "/api/auth/change-password" || pathname === "/api/auth/logout";
  if (session.mustChangePassword && !passwordChangeAllowed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Troque sua senha antes de continuar.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/admin/trocar-senha", request.url));
  }

  if (!session.mustChangePassword && pathname === "/admin/trocar-senha") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/:path*"],
};

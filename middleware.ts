import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ROLE_GUARDS } from "@/lib/auth/roles";

function resolveRequiredRoles(pathname: string) {
  return Object.entries(ROLE_GUARDS).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiredRoles = resolveRequiredRoles(pathname);

  if (requiredRoles === undefined || requiredRoles.length === 0) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const role = (token.role as string) ?? "USER";
  if (!requiredRoles.includes(role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", token.sub ?? "");
  requestHeaders.set("x-user-role", role);
  if (token.email) {
    requestHeaders.set("x-user-email", token.email);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};

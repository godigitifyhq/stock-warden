import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ROLE_GUARDS } from "@/lib/auth/roles";
import { createClient } from "@/utils/supabase/middleware";

function resolveRequiredRoles(pathname: string) {
  return Object.entries(ROLE_GUARDS).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];
}

export default auth(async (request) => {
  const { pathname } = request.nextUrl;
  const requiredRoles = resolveRequiredRoles(pathname);

  if (requiredRoles === undefined || requiredRoles.length === 0) {
    const response = NextResponse.next();
    const { supabase } = createClient(request, response, request.headers);
    await supabase.auth.getUser();
    return response;
  }

  const session = request.auth;
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  if (!requiredRoles.includes(session.user.role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.user.id);
  requestHeaders.set("x-user-role", session.user.role);
  if (session.user.email) {
    requestHeaders.set("x-user-email", session.user.email);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const { supabase } = createClient(request, response, requestHeaders);
  await supabase.auth.getUser();
  return response;
});

export const config = {
  matcher: ["/api/:path*"],
};

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const protectedRoutes = ["/knowledge-base", "/admin", "/settings"];
type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, disabled_at, totp_setup_required")
      .eq("id", user.id)
      .single();

    if (!profile || profile.disabled_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (profile.totp_setup_required) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/setup-2fa";
      return NextResponse.redirect(url);
    }

    const mfaAt = request.cookies.get("mfa_at")?.value;
    const mfaTime = mfaAt ? new Date(mfaAt).getTime() : Number.NaN;
    const hasRememberedDevice = !Number.isNaN(mfaTime);
    const superAdminExpired =
      profile.role === "super_admin" &&
      (!hasRememberedDevice || Date.now() - mfaTime > 24 * 60 * 60 * 1000);

    if (!hasRememberedDevice || superAdminExpired) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa-challenge";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

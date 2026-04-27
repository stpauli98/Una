import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/auth/admin-emails";

/**
 * Next.js 16 proxy (ex-middleware) za Supabase session refresh.
 * Poziva se samo na admin rutama — ne treba trošiti ciklus na javnim.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Osvježi session (čita cookies, setuje fresh access_token ako je istekao)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Guard: ako nije admin a pokušava /admin/* (osim login), redirect
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user || !isAdminEmail(user.email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Guard: ako je logovan a ide na /admin/login, redirect na dashboard
  if (pathname === "/admin/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Matcher: SAMO `/admin/:path*`. API rute (`/api/*`) NISU pokrivene proxy-jem.
 *
 * Ako dodaješ novu API rutu koja zahtijeva auth, uradi jednu od:
 *   1) Pozovi `requireAdmin()` unutar route handler-a (vidi
 *      `src/app/api/availability/route.ts` za primjer).
 *   2) Proširi matcher i dodaj odgovarajući guard ovdje.
 *
 * Public rute (`/`, `/zakazi`, `/galerija`, ...) namjerno nisu pokrivene
 * — proxy se ne troši na rute gdje nema sesije za refresh.
 */
export const config = {
  matcher: ["/admin/:path*"],
};

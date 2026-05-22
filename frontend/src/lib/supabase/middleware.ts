import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isRecruiterRoute =
    path === "/" ||
    path.startsWith("/jobs") ||
    path.startsWith("/candidates") ||
    path.startsWith("/pipeline") ||
    path.startsWith("/settings") ||
    path.startsWith("/recruiter");

  const isCandidateRoute =
    path.startsWith("/candidate") &&
    !path.startsWith("/candidate/sign-in") &&
    !path.startsWith("/candidate/sign-up");

  const isPublic =
    path.startsWith("/sign-in") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/apply/") ||
    path.startsWith("/candidate/sign-in") ||
    path.startsWith("/candidate/sign-up");

  if (!user && isRecruiterRoute && path !== "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (!user && isCandidateRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/candidate/sign-in";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/candidate/sign-in" || path === "/candidate/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = "/candidate";
    return NextResponse.redirect(url);
  }

  if (isPublic || !user) {
    return supabaseResponse;
  }

  return supabaseResponse;
}

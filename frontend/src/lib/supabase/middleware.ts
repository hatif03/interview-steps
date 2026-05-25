import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isCandidatePortalPath, isRecruiterPortalPath } from "@/lib/route-utils";

function resolveUserRole(user: { user_metadata?: Record<string, unknown> }): string | undefined {
  const role = user.user_metadata?.role;
  return role === "recruiter" || role === "candidate" ? role : undefined;
}

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
  const role = user ? resolveUserRole(user) : undefined;

  const isRecruiterRoute = isRecruiterPortalPath(path);

  const isCandidateRoute =
    isCandidatePortalPath(path) &&
    !path.startsWith("/candidate/sign-in") &&
    !path.startsWith("/candidate/sign-up");

  const isPublic =
    path.startsWith("/sign-in") ||
    path.startsWith("/apply/") ||
    path.startsWith("/candidate/sign-in") ||
    path.startsWith("/candidate/sign-up");

  if (user && role === "candidate" && isRecruiterRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/candidate";
    return NextResponse.redirect(url);
  }

  if (user && role === "recruiter" && isCandidateRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

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
    url.pathname = role === "candidate" ? "/candidate" : "/";
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

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/jobs/:path*",
    "/candidates/:path*",
    "/pipeline/:path*",
    "/settings/:path*",
    "/recruiter/:path*",
    "/candidate/:path*",
    "/sign-in",
    "/apply/:path*",
  ],
};

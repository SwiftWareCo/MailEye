import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to check user authentication
 *
 * Avoids making API calls to Stack Auth by checking for session tokens in cookies.
 * This eliminates the loading screen that was occurring from the /api/v1/users/me call.
 *
 * Onboarding checks are deferred to individual pages where they can fetch full user data.
 */
export function middleware(request: NextRequest) {
  // Check for Stack Auth session token in cookies
  // Stack Auth stores the access token in: stack-access-[project-id] cookie
  const hasAuthToken = request.cookies.getAll().some(cookie =>
    cookie.name.includes('stack-access') ||
    cookie.name.includes('stack-refresh')
  );

  // For protected routes (excluding auth pages), check authentication
  if (!hasAuthToken) {
    return NextResponse.redirect(new URL('/handler/sign-in', request.url));
  }

  // Allow authenticated users to proceed
  // Onboarding checks will be handled by individual pages via requireOnboarding()
  return NextResponse.next();
}

export const config = {
  // Protect dashboard routes and onboarding, but allow access to auth pages, Stack handlers, and root
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|handler|sign-in|sign-up|forgot-password).*)',
  ],
};
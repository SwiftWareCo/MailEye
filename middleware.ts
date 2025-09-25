import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "./stack/server";

export async function middleware(request: NextRequest) {
  const user = await stackServerApp.getUser();
  const { pathname } = request.nextUrl;

  // Handle onboarding route specifically
  if (pathname.startsWith('/onboarding')) {
    // If user is not authenticated, redirect to sign-in
    if (!user) {
      return NextResponse.redirect(new URL('/handler/sign-in', request.url));
    }

    // If user has already completed onboarding, redirect to dashboard
    if (user.clientReadOnlyMetadata?.onboardingCompleted) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Allow access to onboarding for authenticated users who haven't completed it
    return NextResponse.next();
  }

  // For other protected routes, check authentication
  if (!user) {
    return NextResponse.redirect(new URL('/handler/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect dashboard routes and onboarding, but allow access to auth pages, Stack handlers, and root
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|handler|sign-in|sign-up|forgot-password).*)',
  ],
};
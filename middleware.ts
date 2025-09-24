import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "./stack/server";

export async function middleware(request: NextRequest) {
  const user = await stackServerApp.getUser();

  // If user is not authenticated, redirect to sign-in page
  if (!user) {
    return NextResponse.redirect(new URL('/handler/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect dashboard routes but allow access to auth pages, Stack handlers, and root
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|handler|sign-in|sign-up|forgot-password).*)',
  ],
};
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.has('access_token_w');
  const isAuthPage = request.nextUrl.pathname === '/login';
  const hasMagicToken = request.nextUrl.searchParams.has('token');
  const isCreatePasswordPage = request.nextUrl.pathname === '/create-password';

  // Allow access to login page with magic token or create password page
  if (hasMagicToken || isCreatePasswordPage) {
    return NextResponse.next();
  }

  if (!isAuthenticated && !isAuthPage) {
    // Redirect unauthenticated users to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAuthPage && !hasMagicToken) {
    // Redirect authenticated users to dashboard, but only if they're not using a magic link
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 
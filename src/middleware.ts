import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that don't require authentication
const publicPaths = [
  '/login',
  '/create-password',
  '/forgot-password',
  '/reset-password',
  '/register',
  '/privacy',
  '/terms',
];

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Check if the path is public
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path) || pathname === '/');

  // Check for authentication token
  const hasAuthCookie = request.cookies.has('access_token_w');

  // Check for special conditions like magic links
  const hasMagicToken = searchParams.has('token');
  const isCreatePasswordPage = pathname === '/create-password';

  console.log(`Path: ${pathname}, Public: ${isPublicPath}, Auth: ${hasAuthCookie}, Token: ${hasMagicToken}`);

  // Allow access to paths with magic tokens
  if (hasMagicToken || isCreatePasswordPage) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login if trying to access protected routes
  if (!hasAuthCookie && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname + request.nextUrl.search);
    console.log(`Redirecting unauthenticated user to: ${loginUrl}`);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login pages (unless using magic link)
  if (hasAuthCookie && pathname === '/login' && !hasMagicToken) {
    console.log('Redirecting authenticated user from login to dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For API routes, add additional headers
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
};
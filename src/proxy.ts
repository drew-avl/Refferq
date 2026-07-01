import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/api/admin') || pathname.startsWith('/admin');
  const isAffiliateRoute = pathname.startsWith('/api/affiliate') || pathname.startsWith('/affiliate');
  const isAuthMeRoute = pathname === '/api/auth/me';
  const isProtectedRoute = isAdminRoute || isAffiliateRoute || isAuthMeRoute;

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId;
    const userRole = payload.role;

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    if (typeof userRole !== 'string' || !userRole) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    if (isAdminRoute && userRole !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        );
      }

      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAffiliateRoute && userRole !== 'AFFILIATE' && userRole !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden: Affiliate access required' },
          { status: 403 }
        );
      }

      return NextResponse.redirect(new URL('/login', request.url));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', userRole);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Authentication proxy error:', error);

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/affiliate/:path*',
    '/api/admin/:path*',
    '/api/affiliate/:path*',
    '/api/auth/me',
  ],
};

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

import { NextResponse } from 'next/server';

// Protect the /report route
const isProtectedRoute = createRouteMatcher(['/report(.*)']);
// Protect the /admin route and API
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // 1. Check basic authentication for protected routes
  if (isProtectedRoute(req) || isAdminRoute(req)) {
    auth().protect();
  }

  // 2. Check Admin Role for admin routes
  if (isAdminRoute(req)) {
    const { userId } = auth();
    if (userId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      try {
        // Query user_profiles table directly using Supabase REST API
        const res = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=role`, {
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        const data = await res.json();
        
        // If not found or not admin
        if (!data || data.length === 0 || data[0].role !== 'admin') {
          if (req.nextUrl.pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
          }
          return NextResponse.redirect(new URL('/', req.url));
        }
      } catch (e) {
        console.error('Middleware RBAC Error:', e);
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

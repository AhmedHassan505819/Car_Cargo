import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (icons, manifest, etc.)
     * - API routes for public tracking
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest|sw\\.js|api/track/).*)',
  ],
};

import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy sederhana — auth check dilakukan di server components.
 * Middleware hanya meneruskan request; redirect ditangani oleh masing-masing page.tsx
 * 
 * Alasan: createServerClient dari @supabase/ssr tidak reliabel di Edge Runtime Vercel.
 * Session refresh dilakukan di server.ts yang berjalan di Node.js runtime.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.*|manifest.webmanifest|robots.txt).*)',
  ],
}

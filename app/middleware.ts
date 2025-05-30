import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getFirebaseAdmin } from '@/lib/firebase/admin'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  try {
    const sessionCookie = req.cookies.get('session')?.value

    let isAuthenticated = false
    if (sessionCookie) {
      const auth = getFirebaseAdmin()
      try {
        await auth.verifySessionCookie(sessionCookie, true)
        isAuthenticated = true
      } catch (error) {
        console.error('Invalid session cookie:', error)
      }
    }

    if (
      !isAuthenticated &&
      (req.nextUrl.pathname.startsWith("/dashboard") ||
        req.nextUrl.pathname.startsWith("/nursing-homes") ||
        req.nextUrl.pathname.startsWith("/patients"))
    ) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = "/"
      redirectUrl.searchParams.set(`redirectedFrom`, req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    if (isAuthenticated && req.nextUrl.pathname === "/") {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = "/dashboard"
      return NextResponse.redirect(redirectUrl)
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/', req.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}

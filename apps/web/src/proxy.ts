import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
    '/profile(.*)',
    '/api/wardrobe(.*)',
])

const missingDevClerk = !process.env.CLERK_SECRET_KEY && process.env.NODE_ENV !== 'production'

const devBypassMiddleware = function proxy() {
    return NextResponse.next()
}

export default missingDevClerk ? devBypassMiddleware : clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
    matcher: [
        '/',
        '/index',
        '/profile/:path*',
        '/api/wardrobe/:path*',
    ],
}

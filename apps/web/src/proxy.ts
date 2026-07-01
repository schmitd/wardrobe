import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/',
    '/api/context(.*)',
    '/api/uploadthing(.*)',
    '/api/stripe/webhook',
])

const missingDevClerk = !process.env.CLERK_SECRET_KEY && process.env.NODE_ENV !== 'production'

const devBypassMiddleware = function proxy() {
    return NextResponse.next()
}

export default missingDevClerk ? devBypassMiddleware : clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) await auth.protect()
})

export const config = {
    matcher: [
        '/',
        '/index',
        '/check/:path*',
        '/profile/:path*',
        '/api/wardrobe/:path*',
    ],
}

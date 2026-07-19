import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
    '/fits(.*)',
    '/profile(.*)',
    '/wardrobes(.*)',
    '/api/wardrobe(.*)',
    '/api/mobile(.*)',
])

export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
    matcher: [
        // Server Actions post back to the route that rendered them. Keep the
        // Clerk proxy active for every application route, while avoiding
        // Next's internals and static assets.
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // API routes must always run through Clerk, even if they have an
        // extension-like path segment.
        '/(api|trpc)(.*)',
    ],
}

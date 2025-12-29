import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/api/uploadthing(.*)',
    '/api/stripe/webhook',
])

export default clerkMiddleware(async (auth, req) => {
    const isApiRoute = req.nextUrl.pathname.startsWith('/api/');
    const isServerAction = req.headers.has('next-action');
    const isStripeWebhook = req.nextUrl.pathname === '/api/stripe/webhook';

    if ((isApiRoute || isServerAction) && !isStripeWebhook) {
        console.log(`[BotID] Starting check for ${req.nextUrl.pathname}`);
        const verification = await checkBotId({
            advancedOptions: {
                headers: Object.fromEntries(req.headers.entries())
            }
        });
        console.log(`[BotID] Check complete: isBot=${verification.isBot}`);

        console.log(`[BotID] Path: ${req.nextUrl.pathname}, isBot: ${verification.isBot}, isServerAction: ${isServerAction}`);

        if (verification.isBot) {
            return NextResponse.json({ error: 'Access denied: Bot detected' }, { status: 403 });
        }
    }

    if (!isPublicRoute(req)) await auth.protect()
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}

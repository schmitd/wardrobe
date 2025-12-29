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
        // Structured logging for better observability
        console.log(JSON.stringify({
            level: 'info',
            message: 'BotID check starting',
            path: req.nextUrl.pathname,
            isServerAction
        }));

        let isBot = false;

        try {
            // Sanitize headers to prevent leaking sensitive credentials
            const headers = Object.fromEntries(req.headers.entries());
            const safeHeaders = { ...headers };
            delete safeHeaders['authorization'];
            // Note: Cookies are preserved as they are often critical for bot detection.

            const verification = await checkBotId({
                advancedOptions: {
                    headers: safeHeaders
                }
            });

            isBot = verification.isBot;

            console.log(JSON.stringify({
                level: 'info',
                message: 'BotID check complete',
                path: req.nextUrl.pathname,
                isBot
            }));

        } catch (error) {
            // Fail-closed strategy: ensure security even if verification service fails
            console.error(JSON.stringify({
                level: 'error',
                message: 'BotID check failed',
                error: String(error),
                path: req.nextUrl.pathname
            }));

            // Deny the request if we cannot verify it isn't a bot
            return NextResponse.json(
                { error: 'Security verification unavailable. Please try again later.' },
                { status: 503 }
            );
        }

        if (isBot) {
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

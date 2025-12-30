import arcjet, { detectBot } from "@arcjet/next";

export const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    characteristics: ["userId"], // Identify users by their ID
    rules: [
        // Rules are constructed dynamically in the handlers
    ],
});

// Bot detection rule for costly routes
export const botDetectionRule = detectBot({
    mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
    // Block all bots except the following
    allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        "CATEGORY:MONITOR",       // Uptime monitoring services
        "CATEGORY:PREVIEW",       // Link previews e.g. Slack, Discord
    ],
});

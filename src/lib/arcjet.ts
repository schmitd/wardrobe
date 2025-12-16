import arcjet from "@arcjet/next";

export const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    characteristics: ["userId"], // Identify users by their ID
    rules: [
        // Rules are constructed dynamically in the handlers
    ],
});

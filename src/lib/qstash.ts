import { Client } from "@upstash/qstash";

export const qstashClient = process.env.QSTASH_TOKEN
    ? new Client({ token: process.env.QSTASH_TOKEN })
    : null;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

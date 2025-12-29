import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const data = await processUserRequest(request);
    return NextResponse.json({ data });
}

async function processUserRequest(request: NextRequest) {
    return createRouteHandler({ router: ourFileRouter });
}
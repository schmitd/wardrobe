import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createWardrobeContextClient } from "@wardrobe/context-client";
import type { StyleFitRequest } from "@wardrobe/shared";

const port = Number(process.env.PORT ?? 8787);
const wardrobeBaseUrl = process.env.WARDROBE_API_URL ?? "http://localhost:3000";
const wardrobeApiToken = process.env.WARDROBE_API_TOKEN;
const widgetUri = "ui://wardrobe/style-fit-widget.html";

type JsonRpcRequest = {
  id?: string | number;
  method: string;
  params?: unknown;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const toolDescriptor = {
  name: "check_style_fit",
  title: "Check style fit",
  description:
    "Use this when the user wants to know whether a clothing item or product page fits their wardrobe style.",
  inputSchema: {
    type: "object",
    properties: {
      imageUrl: { type: "string", description: "Product image URL." },
      pageUrl: { type: "string", description: "Product page URL." },
      title: { type: "string", description: "Product title." },
      description: { type: "string", description: "Visible product description." },
      userContext: { type: "string", description: "Optional wardrobe or style context from the user." },
    },
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  _meta: {
    "openai/toolInvocation/invoking": "Checking style fit",
    "openai/toolInvocation/invoked": "Style fit checked",
    "openai/outputTemplate": widgetUri,
    "ui.resourceUri": widgetUri,
  },
};

const handleToolCall = async (params: unknown) => {
  const payload = params as { name?: string; arguments?: StyleFitRequest };
  if (payload.name !== "check_style_fit") {
    throw new Error(`Unknown tool: ${payload.name}`);
  }

  const client = createWardrobeContextClient({ baseUrl: wardrobeBaseUrl, token: wardrobeApiToken });
  const result = await client.checkStyleFit(payload.arguments ?? {});

  return {
    content: [{ type: "text", text: `${result.score}% fit: ${result.summary}` }],
    structuredContent: result,
    _meta: {
      "ui.resourceUri": widgetUri,
    },
  };
};

const handleRpc = async (request: JsonRpcRequest) => {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "wardrobe-chatgpt-app", version: "0.1.0" },
        capabilities: { tools: {}, resources: {} },
        instructions:
          "Wardrobe helps users evaluate whether shopping candidates fit their closet and personal style.",
      };
    case "tools/list":
      return { tools: [toolDescriptor] };
    case "tools/call":
      return handleToolCall(request.params);
    case "resources/read":
      return {
        contents: [
          {
            uri: widgetUri,
            mimeType: "text/html;profile=mcp-app",
            text: await readFile(join(import.meta.dir, "../public/style-fit-widget.html"), "utf8"),
            _meta: {
              "ui.csp": {
                connect_domains: [wardrobeBaseUrl],
                resource_domains: [],
              },
              "openai/widgetDescription": "A compact fit-score widget for Wardrobe style checks.",
              "openai/widgetPrefersBorder": true,
            },
          },
        ],
      };
    default:
      throw new Error(`Unsupported method: ${request.method}`);
  }
};

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (url.pathname !== "/mcp" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const rpc = (await request.json()) as JsonRpcRequest;

    try {
      return json({ jsonrpc: "2.0", id: rpc.id, result: await handleRpc(rpc) });
    } catch (error) {
      return json(
        {
          jsonrpc: "2.0",
          id: rpc.id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : "MCP error",
          },
        },
        500
      );
    }
  },
});

console.info(`Wardrobe ChatGPT MCP app listening on http://localhost:${port}/mcp`);

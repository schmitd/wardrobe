import { ZepClient } from "@getzep/zep-cloud";

const ZEP_API_KEY = process.env.ZEP_KEY;

let zepClient: ZepClient | null = null;

if (ZEP_API_KEY) {
  zepClient = new ZepClient({
    apiKey: ZEP_API_KEY,
  });
}

export { zepClient };

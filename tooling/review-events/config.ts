import { isAbsolute } from "node:path";
export type Config = { port: number; secretFile: string; stateDirectory: string; trustedRoot: string; trustedActors: string[]; execute: boolean };
export async function readConfig(path: string): Promise<Config> {
  const c = await Bun.file(path).json() as Config;
  if (!Number.isSafeInteger(c.port) || c.port < 1024 || c.port > 65535 || typeof c.execute !== "boolean" || !Array.isArray(c.trustedActors) || !c.trustedActors.length || c.trustedActors.some(a => !/^[a-zA-Z0-9-]+$/.test(a))) throw new Error("Invalid service configuration");
  for (const key of ["secretFile", "stateDirectory", "trustedRoot"] as const) if (typeof c[key] !== "string" || !isAbsolute(c[key])) throw new Error(`Invalid ${key}`);
  return c;
}

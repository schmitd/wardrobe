import React from "react";

// Only the standalone gallery uses these adapters. No application auth bypass exists.
export const useUser = () => ({ user: { id: "synthetic-alice", externalAccounts: [], createExternalAccount: async () => { throw new Error("External authentication is outside this fixture"); } } });
export const useQuery = () => [];
export const api = { wardrobes: { listWardrobes: "synthetic-list" } };
export const analytics = { capture() {}, captureException() {}, has_opted_out_capturing: () => true };
export const Link = ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>;
export const Image = ({ fill: _fill, unoptimized: _unoptimized, ...props }: React.ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => <img alt={props.alt ?? ""} {...props} />; // eslint-disable-line @next/next/no-img-element, @typescript-eslint/no-unused-vars

async function action(name: string, input?: unknown) {
  const response = await fetch(`/__fixture/action/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input ?? {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Synthetic failure");
  return data;
}
export const getUploadUrlAction = () => action("upload-url");
export const routeCaptureAction = (input: unknown) => action("route", input);
export const recordDailyFitCheckAction = (input: unknown) => action("daily-fit", input);
export const createWardrobeItemAction = (input: unknown) => action("create-piece", input);
export const checkCompatibilityAction = (input: unknown) => action("try-on", input);
export const saveInspirationAction = (input: unknown) => action("save-inspiration", input);

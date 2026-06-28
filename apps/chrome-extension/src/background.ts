import { createWardrobeContextClient } from "@wardrobe/context-client";

const defaultApiBaseUrl = "http://localhost:3000";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const product = await chrome.tabs.sendMessage(tab.id, { type: "WARDROBE_COLLECT_PRODUCT" });
  const settings = (await chrome.storage.sync.get(["wardrobeApiBaseUrl", "wardrobeToken"])) as {
    wardrobeApiBaseUrl?: string;
    wardrobeToken?: string;
  };
  const client = createWardrobeContextClient({
    baseUrl: settings.wardrobeApiBaseUrl ?? defaultApiBaseUrl,
    token: settings.wardrobeToken,
  });

  const result = await client.checkStyleFit(product);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [result],
    func: (styleResult: { score: number; summary: string; reasons: string[] }) => {
      const previous = document.getElementById("wardrobe-style-fit-result");
      previous?.remove();

      const panel = document.createElement("aside");
      panel.id = "wardrobe-style-fit-result";
      panel.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "right:18px",
        "top:18px",
        "width:min(360px,calc(100vw - 36px))",
        "background:white",
        "color:#111827",
        "border:2px solid #111827",
        "box-shadow:6px 6px 0 #111827",
        "padding:16px",
        "font:14px system-ui,sans-serif",
      ].join(";");

      const close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", "Close");
      close.textContent = "x";
      close.style.cssText = "float:right;border:0;background:transparent;font-size:20px;cursor:pointer";
      close.addEventListener("click", () => panel.remove());

      const score = document.createElement("strong");
      score.textContent = `Wardrobe fit: ${styleResult.score}%`;
      score.style.cssText = "display:block;color:#310A31;font-size:18px;margin-bottom:8px";

      const summary = document.createElement("p");
      summary.textContent = styleResult.summary;
      summary.style.cssText = "margin:0 0 8px";

      const reasons = document.createElement("ul");
      reasons.style.cssText = "margin:0;padding-left:18px";
      for (const reason of styleResult.reasons) {
        const item = document.createElement("li");
        item.textContent = reason;
        reasons.append(item);
      }

      panel.append(close, score, summary, reasons);
      document.body.append(panel);
    },
  });
});

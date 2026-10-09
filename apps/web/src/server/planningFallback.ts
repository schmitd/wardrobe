import type { PlanningDay, PlanningSource } from "./inference/planning";
import { forecastAdvice } from "../services/PlanningWeatherService";

/** Conservative fallback: only known categories, never inferred ownership or occasion. */
export function everydayOutfits(data: PlanningSource, days: PlanningDay[]) {
  const pick = (pattern: RegExp) => data.items.find(item => pattern.test(item.category));
  return days.map(day => {
  const workToSkate = /\bwork\b/i.test(day.description) && /\bskat(?:e|ing)\b/i.test(day.description);
  const collared = workToSkate ? data.items.find(item => /^(top|shirt|polo|mens polo shirt)$/i.test(item.category) && /collar|polo|button/i.test(item.description)) : undefined;
  const top = collared ?? pick(/^(top|shirt|t-shirt|tee|polo|sweater|blouse|mens polo shirt)$/i);
  const bottom = (workToSkate ? pick(/^(trousers|pants|chinos|jeans)$/i) : undefined) ?? pick(/^(bottom|trousers|pants|chinos|jeans|shorts|skirt)$/i);
  const dress = !top || !bottom ? pick(/^(dress|jumpsuit|one.?piece)$/i) : undefined;
  const shoes = pick(/^(footwear|shoes|sneakers|boots|running shoes)$/i);
  const layer = pick(/^(outerwear|jacket|coat|cardigan)$/i);
  const selected = [...(dress ? [dress] : [top, bottom]), shoes, layer].filter((item): item is PlanningSource["items"][number] => Boolean(item));
  const missing = [...(!dress && !top ? ["Top"] : []), ...(!dress && !bottom ? ["Bottom"] : []), ...(!shoes ? ["Weather-suitable shoes"] : [])];
  return {
    date: day.date, title: selected.length ? "Everyday starting outfit" : "Build an everyday outfit",
    itemIds: selected.map(item => item.id), missing,
    rationale: `${selected.length ? "Start with " + selected.map(item => `${item.category}: ${item.description.slice(0, 180) || "your owned piece"}`).join("; ") + "." : "Add an everyday top, bottom and shoes to build an outfit."} ${layer ? "Keep the outer layer removable." : "Add a removable layer if needed."} ${day.description || day.calendar?.events.length ? "This is a basic starting point; review your activities and dress requirements before using it." : "A simple starting point for an ordinary day."} ${workToSkate ? "For work, start with the collared or everyday top and trousers. After work, remove any outer layer for skating and check that the trousers and shoes allow comfortable movement; adapt to your workplace dress requirements." : ""} ${forecastAdvice(day.weather)}`,
    context: ["Owned wardrobe", "Basic recommendation; detailed planning unavailable", ...(day.calendar ? ["Google Calendar context available"] : day.calendarUnavailable ? ["Calendar unavailable; everyday defaults used"] : []), forecastAdvice(day.weather)],
  };
  });
}

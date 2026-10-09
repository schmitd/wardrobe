import { sevenDays } from "@wardrobe/shared";
/** Resolve the common explicit weekday request within the selected active window. */
export function weekdayPlans(description: string, week: string) {
  // This shortcut has a selected window, not a today/timezone anchor. Leave
  // explicit dates and relative timing to the existing interpreter instead.
  const month = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const calendarDate = new RegExp(`\\b${month}\\.?\\s+(?:the\\s+)?\\d{1,2}\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${month}\\b|\\b(?:in|on|of|until|through)\\s+${month}\\b`, "i");
  const relativeDuration = /\b(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|few|several|couple(?: of)?)\s+(?:business\s+)?(?:days?|weeks?|months?|years?|fortnights?)\b|\b(?:this|coming|following|upcoming|previous)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|month|year)\b|\b(?:before|after|until|through|following)\s+(?:this|the|current|selected)\s+week\b/i;
  if (calendarDate.test(description) || relativeDuration.test(description) || /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b|\b\d{1,2}(?:st|nd|rd|th)\b/i.test(description)) return null;
  // An unqualified single weekday has exactly one occurrence in this window.
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const mentioned = names.filter(name => new RegExp(`\\b${name}\\b`, "i").test(description));
  if (mentioned.length === 1 && !/\b(next|last|except|excluding|tomorrow|today|weekdays|every|each)\b|\d{4}-\d{2}-\d{2}/i.test(description)) {
    const date = sevenDays(week).find(date => names[new Date(`${date}T12:00:00Z`).getUTCDay()] === mentioned[0])!;
    return { days: [{ date, description: description.slice(0, 1200) }], clarification: "", assumption: "Using the named weekday in the selected seven-day window." };
  }
  if (!/\b(each weekday|every weekday|weekdays)\b/i.test(description) || !/\b(this week|for the week)\b/i.test(description)) return null;
  // Explicit exceptions/dates still go through the interpreter; never overwrite them.
  if (/\b(except|excluding|but not|next week|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\d{4}-\d{2}-\d{2}/i.test(description)) return null;
  return {
    days: sevenDays(week).filter(date => { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return day > 0 && day < 6; }).map(date => ({ date, description: description.slice(0, 1200) })),
    clarification: "", assumption: "Using Monday–Friday in the selected seven-day window. Edit your plans to change the days.",
  };
}

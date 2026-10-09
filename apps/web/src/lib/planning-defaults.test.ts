import { expect, test } from "bun:test";
import { weekdayPlans } from "./planning-defaults";
test("work-to-skating weekdays resolve without asking the user to list dates", () => {
  const result = weekdayPlans("For this week, I need to dress each weekday for work while being able to skate after work.", "2026-10-07");
  expect(result?.days.map(day => day.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13"]);
  expect(result?.clarification).toBe("");
  expect(result?.assumption).toContain("Monday–Friday");
  expect(weekdayPlans("This week each weekday except Friday", "2026-10-07")).toBeNull();
  expect(weekdayPlans("This week each weekday and next week too", "2026-10-07")).toBeNull();
});
test("an unqualified weekday resolves within a window starting midweek; relative qualifiers remain explicit", () => {
  expect(weekdayPlans("Monday work then skate", "2026-10-07")?.days[0].date).toBe("2026-10-12");
  expect(weekdayPlans("Wednesday work then skate", "2026-10-07")?.days[0].date).toBe("2026-10-07");
  expect(weekdayPlans("Next Monday work", "2026-10-07")).toBeNull();
});

test("explicit relative timing and calendar dates defer to interpretation rather than a window weekday", () => {
  for (const description of [
    "Monday in two weeks: work then skate",
    "Monday in 2 weeks: work then skate",
    "Monday two weeks from now: work then skate",
    "Monday after this week",
    "Monday on October 19",
    "Monday 19 October 2026",
    "Monday 10/19/2026",
    "Monday, October 26: work then skate",
    "Monday on 10/26/2026: work then skate",
    "Monday on 26 October 2026: work then skate",
    "Monday on 2026-10-26: work then skate",
    "This week, each weekday until October 26",
    "For the week, every weekday starting in two weeks",
  ]) {
    expect(weekdayPlans(description, "2026-10-07")).toBeNull();
  }
  expect(weekdayPlans("Monday work at 9 then skate at 5", "2026-10-07")?.days[0].date).toBe("2026-10-12");
});

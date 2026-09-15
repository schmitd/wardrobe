import { useState } from "react";
import { router, Stack } from "expo-router";
import { Switch, Text, View } from "react-native";
import { usePlanner } from "../src/store";
import {
  Caption,
  Group,
  Page,
  Primary,
  Row,
  Section,
  dateLabel,
  usePalette,
} from "../src/ui";
export default function Calendar() {
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  const [step, setStep] = useState<"intro" | "consent" | "choose" | "error">(
    state.connected ? "choose" : "intro",
  );
  const [selected, setSelected] = useState(
    state.connected ? state.calendars : ["Personal"],
  );
  const toggle = (name: string) =>
    setSelected((current) =>
      current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name],
    );
  return (
    <>
      <Page>
        {step === "intro" ? (
          <>
            <Text style={{ color: c.ink, fontSize: 26, fontWeight: "600" }}>
              An outfit that fits your plans.
            </Text>
            <Text style={{ color: c.muted, fontSize: 17, lineHeight: 25 }}>
              Use events in the week of {dateLabel(state.week)} to give your
              outfits a little more context.
            </Text>
            <Group>
              <Row title="You choose the calendars" symbol="calendar" />
              <Row
                title="Read-only access"
                subtitle="Wardrobe never adds or changes events."
                symbol="lock"
                last
              />
            </Group>
            <Primary
              title="Continue with Google"
              onPress={() => setStep("consent")}
            />
            <Caption>
              Prototype: the next step previews sign-in. No Google account is
              accessed.
            </Caption>
          </>
        ) : step === "consent" ? (
          <>
            <Section title="Sign-in preview">
              <Group>
                <Row
                  title="Google opens securely"
                  subtitle="In the live app, this step uses Google’s authorization screen—not a custom login form."
                  symbol="lock.shield"
                  last
                />
              </Group>
            </Section>
            <Caption>
              This local simulation lets you test returning to the same day and
              draft. It does not grant real access.
            </Caption>
            <Primary
              title="Simulate successful sign-in"
              onPress={() => setStep("choose")}
            />
            <Group>
              <Row
                title="Simulate cancelled sign-in"
                onPress={() => router.back()}
              />
              <Row
                title="Simulate connection error"
                onPress={() => setStep("error")}
                last
              />
            </Group>
          </>
        ) : step === "error" ? (
          <>
            <Text
              accessibilityRole="alert"
              selectable
              style={{ color: c.ink, fontSize: 22, fontWeight: "600" }}
            >
              Calendar didn’t connect.
            </Text>
            <Caption>
              Your day and draft are still here. You can try again or continue
              without Calendar.
            </Caption>
            <Primary title="Try again" onPress={() => setStep("consent")} />
            <Group>
              <Row
                title="Continue without Calendar"
                onPress={() => router.back()}
                last
              />
            </Group>
          </>
        ) : (
          <>
            <Section
              title="Use these calendars"
              footer="Only the days you request are read. Calendar context is sent for outfit generation, never to product analytics."
            >
              <Group>
                {["Personal", "Work"].map((name, i) => (
                  <Row
                    key={name}
                    title={name}
                    symbol="calendar"
                    trailing={
                      <Switch
                        accessibilityLabel={`Use ${name} calendar`}
                        value={selected.includes(name)}
                        onValueChange={() => toggle(name)}
                      />
                    }
                    last={i === 1}
                  />
                ))}
              </Group>
            </Section>
            {state.connected ? (
              <Group>
                <Row
                  title="Use for suggestions"
                  trailing={
                    <Switch
                      accessibilityLabel="Use Calendar for suggestions"
                      value={state.useCalendar}
                      onValueChange={(enabled) =>
                        dispatch({ type: "use-calendar", enabled })
                      }
                    />
                  }
                />
                <Row
                  title="Connection settings"
                  subtitle="Account and disconnect controls belong here, away from outfit planning."
                  onPress={() => router.replace("/options")}
                  last
                />
              </Group>
            ) : null}
            <Primary
              title={state.connected ? "Done" : "Use selected calendars"}
              disabled={!selected.length}
              onPress={() => {
                const useCalendar = state.useCalendar;
                dispatch({ type: "connect", calendars: selected });
                if (state.connected && !useCalendar)
                  dispatch({ type: "use-calendar", enabled: false });
                router.back();
              }}
            />
            <Caption>
              Sample calendars for design review. Your date and draft will be
              preserved.
            </Caption>
          </>
        )}
      </Page>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button onPress={() => router.back()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

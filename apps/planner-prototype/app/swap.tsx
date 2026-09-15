import { router, Stack, useLocalSearchParams } from "expo-router";
import { alternatives, wardrobe } from "../src/model";
import { usePlanner } from "../src/store";
import { Caption, Group, Page, Row, Symbol } from "../src/ui";
export default function Swap() {
  const { piece } = useLocalSearchParams<{ piece: string }>();
  const { dispatch } = usePlanner();
  return (
    <>
      <Page>
        <Caption>Choose another piece you own.</Caption>
        <Group>
          {(alternatives[piece] ?? []).map((id, i, all) => {
            const p = wardrobe.find((p) => p.id === id)!;
            return (
              <Row
                key={id}
                title={p.name}
                subtitle={p.detail}
                trailing={id === piece ? <Symbol name="checkmark" /> : null}
                onPress={() => {
                  dispatch({ type: "swap", old: piece, next: id });
                  router.back();
                }}
                last={i === all.length - 1}
              />
            );
          })}
        </Group>
      </Page>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button onPress={() => router.back()}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

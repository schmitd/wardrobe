import { expect, test } from "bun:test";
import { ESLint, Linter } from "eslint";
import { resolve } from "node:path";
import ux from "./ux-eslint.mjs";

const lint = (rule: string, code: string, filename = "src/components/CollectionsWorkspace.tsx") => new Linter().verify(code, [{
  files: ["**/*.tsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { ux }, rules: { [`ux/${rule}`]: "error" },
}], { filename });
test("production ESLint configuration gates typed entity choices and excludes test fixtures", async () => {
  const eslint = new ESLint({ cwd: resolve(import.meta.dir, ".."), overrideConfigFile: resolve(import.meta.dir, "../eslint.config.mjs") });
  const config = await eslint.calculateConfigForFile("src/components/DataManagement.tsx");
  for (const name of Object.keys(ux.rules)) expect(config.rules[`ux/${name}`][0]).toBe(2);
  const [result] = await eslint.lintText('const collectionId: string = "private"; export const view = <select><option value={collectionId}>Collection</option></select>;', { filePath: "src/components/DataManagement.tsx" });
  expect(result.messages.filter(message => message.ruleId === "ux/entity-selection")).toHaveLength(1);
  const testConfig = await eslint.calculateConfigForFile("src/components/DataManagement.test.tsx");
  expect(testConfig.rules["ux/entity-selection"]).toBeUndefined();
});
function rejects(rule: string, code: string, filename?: string) {
  const messages = lint(rule, code, filename);
  expect(messages.map(message => message.ruleId)).toEqual([`ux/${rule}`]);
  expect(messages[0].severity).toBe(2);
}
test("entity selection rejects mapped collection/piece choices, including wrapped IDs", () => {
  rejects("entity-selection", 'const ui = <select>{collections.map(c => <option value={c._id}>{c.name}</option>)}</select>');
  rejects("entity-selection", 'const ui = <select>{plans.map(p => <option value={String(p._id)}>{p.name}</option>)}</select>', "src/components/TryOnFeedback.tsx");
  rejects("entity-selection", 'const ui = <select>{items.map(item => <option value={item.id}>{item.category}</option>)}</select>');
  rejects("entity-selection", 'const ui = <select><option value={collectionId}>Collection</option></select>');
});
test("entity selection preserves generic preferences, image-first buttons and platform affordances", () => {
  for (const code of [
    'const ui = <select><option value="metric">Metric</option><option value="imperial">Imperial</option></select>',
    'const ui = <select>{languages.map(l => <option value={l.code}>{l.name}</option>)}</select>',
    'const ui = <section>{items.map(item => <button onClick={() => choose(item.id)}>{item.category}</button>)}</section>',
    'const ui = <input type="file" accept="image/*" capture="environment" />; navigator.mediaDevices.getUserMedia({video:true}); event.prompt();',
  ]) expect(lint("entity-selection", code)).toHaveLength(0);
});
test("direct rendered IDs fail while keys, transport, human labels and outfitText pass", () => {
  rejects("visible-entity-id", 'const ui = <p>{item._id}</p>');
  rejects("visible-entity-id", 'const ui = <p>{String(collectionId)}</p>');
  rejects("visible-entity-id", 'const ui = <button aria-label={`Open ${item._id}`}>Open</button>');
  rejects("visible-entity-id", 'const ui = <img alt={"Piece " + pieceId} />');
  expect(lint("visible-entity-id", 'const ui = <button key={item._id} data-item-id={item._id} onClick={() => choose(item._id)} aria-label={item.name}>{outfitText(item.description, [item._id])}</button>')).toHaveLength(0);
});
test("main removed browsers fail; Data management and action-triggered Undo pass", () => {
  rejects("recovery-location", 'usePaginatedQuery(api.wardrobe.pageCollections, {archived:true}, {initialNumItems:20})');
  rejects("recovery-location", 'usePaginatedQuery(api.wardrobe.pageInspiration, {wardrobeId, removed:true}, {initialNumItems:20})');
  expect(lint("recovery-location", 'usePaginatedQuery(api.wardrobe.pageCollections, {archived:true}, {initialNumItems:20})', "src/components/DataManagement.tsx")).toHaveLength(0);
  expect(lint("recovery-location", 'archive({wardrobeId, archived:true}); notify({message:"Collection removed", action:{label:"Undo", onClick:restore}})')).toHaveLength(0);
  expect(lint("recovery-location", 'usePaginatedQuery(api.wardrobe.pageCollections, {archived:false}, {initialNumItems:20})')).toHaveLength(0);
});
test("entity browser dialogs fail without banning platform permissions/install or Calendar revocation", () => {
  rejects("entity-browser-dialog", 'window.confirm("Choose collection?")', "src/components/DataManagement.tsx");
  rejects("entity-browser-dialog", 'prompt("Piece ID")', "src/components/ItemDetailsDrawer.tsx");
  expect(lint("entity-browser-dialog", 'event.prompt(); navigator.mediaDevices.getUserMedia({video:true})', "src/components/UnifiedCapture.tsx")).toHaveLength(0);
  expect(lint("entity-browser-dialog", 'window.confirm("Revoke Calendar?")', "src/components/GoogleCalendarConnect.tsx")).toHaveLength(0);
});

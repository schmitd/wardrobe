// Narrow syntactic guarantees. State truth, geometry and copy require real UI review.
const entityIds = new Set(["itemId", "pieceId", "wardrobeId", "collectionId", "membershipId", "planId"]);
const entityLists = new Set(["items", "pieces", "collections", "wardrobes", "plans", "inspirations"]);
const member = (node, name) => node?.type === "MemberExpression" && !node.computed && node.property.name === name;
const rawId = node => node?.type === "Identifier" ? entityIds.has(node.name) : member(node, "_id");
function some(node, predicate, keys) {
  if (!node || typeof node !== "object") return false;
  if (predicate(node)) return true;
  return (keys[node.type] ?? []).some(key => {
    const child = node[key];
    return Array.isArray(child) ? child.some(value => some(value, predicate, keys)) : some(child, predicate, keys);
  });
}
function displayedId(node) {
  if (rawId(node)) return true;
  if (node?.type === "TemplateLiteral") return node.expressions.some(displayedId);
  if (node?.type === "BinaryExpression" && node.operator === "+") return displayedId(node.left) || displayedId(node.right);
  if (node?.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "String") return node.arguments.some(displayedId);
  return false;
}
/** @returns {import("eslint").Rule.RuleMetaData} */
const meta = (description, message) => ({ type: "problem", docs: { description }, schema: [], messages: { violation: message } });
const ux = { rules: {
  "entity-selection": {
    meta: meta("Keep app-owned entity choices inside the app", "Use inline collection choices or OwnedPiecePicker in the existing TaskSheet; native entity select opens an OS chooser."),
    create(context) {
      const keys = context.sourceCode.visitorKeys;
      return { JSXElement(node) {
        if (node.openingElement.name.type !== "JSXIdentifier" || node.openingElement.name.name !== "select") return;
        const entityOptions = some(node, child => child.type === "JSXAttribute" && child.name.name === "value" && some(child.value, rawId, keys), keys);
        const entityMap = some(node, child => child.type === "CallExpression" && member(child.callee, "map") && (
          entityLists.has(child.callee.object.name) || (child.callee.object.type === "MemberExpression" && entityLists.has(child.callee.object.property.name))
        ), keys);
        if (entityOptions || entityMap) context.report({ node: node.openingElement, messageId: "violation" });
      } };
    },
  },
  "visible-entity-id": {
    meta: meta("Do not expose transport IDs as user-facing prose", "Render a human label; sanitize generated/stored prose with outfitText. IDs belong in keys, values or transport data."),
    create(context) { return {
      JSXExpressionContainer(node) {
        const parent = node.parent;
        const visible = parent.type === "JSXElement" || (parent.type === "JSXAttribute" && ["aria-label", "title", "alt"].includes(parent.name.name));
        if (visible && displayedId(node.expression)) context.report({ node, messageId: "violation" });
      },
    }; },
  },
  "recovery-location": {
    meta: meta("Keep removed entity browsers in account Data management", "Browse removed collections/inspiration in account Data management. Main collections may retain action-triggered Undo."),
    create(context) {
      if (!context.filename.replaceAll("\\", "/").endsWith("/CollectionsWorkspace.tsx")) return {};
      return { CallExpression(node) {
        const target = node.arguments[0];
        const field = member(target, "pageCollections") ? "archived" : member(target, "pageInspiration") ? "removed" : null;
        if (!field || !member(target.object, "wardrobe")) return;
        if (node.arguments[1]?.type === "ObjectExpression" && node.arguments[1].properties.some(property => property.type === "Property" && !property.computed && (property.key.name ?? property.key.value) === field && property.value.type === "Literal" && property.value.value === true)) {
          context.report({ node, messageId: "violation" });
        }
      } };
    },
  },
  "entity-browser-dialog": {
    meta: meta("Use app interaction surfaces for entity tasks", "Use the existing TaskSheet/inline choices for entity interactions instead of browser prompt/confirm."),
    create(context) {
      if (!/(?:DataManagement|CollectionsWorkspace|OwnedPiecePicker|ItemDetailsDrawer|TryOnFeedback)\.tsx$/.test(context.filename)) return {};
      return { CallExpression(node) {
        const callee = node.callee;
        if ((callee.type === "Identifier" && ["confirm", "prompt"].includes(callee.name)) || (callee.type === "MemberExpression" && ["window", "globalThis"].includes(callee.object.name) && !callee.computed && ["confirm", "prompt"].includes(callee.property.name))) context.report({ node, messageId: "violation" });
      } };
    },
  },
} };
export default ux;

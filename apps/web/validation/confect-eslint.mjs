// Mechanical boundaries only. Authentication/data-flow correctness belongs to review.
const member = (node, name) => node?.type === "MemberExpression" && !node.computed && node.property.name === name;
/** @returns {import("eslint").Rule.RuleModule} */
const rule = (description, create) => ({ meta: { type: "problem", docs: { description }, schema: [], messages: { boundary: description } }, create });

const plugin = {
  rules: {
    "storage-authority": rule("Use the shared storage authority; only storageAccess issues URLs and account/upload cleanup deletes blobs.", context => ({
      CallExpression(node) {
        const callee = node.callee;
        if (!member(callee?.object, "storage")) return;
        const file = context.filename.replaceAll("\\", "/");
        if ((member(callee, "getUrl") && !file.endsWith("/confect/storageAccess.ts")) ||
            (member(callee, "delete") && !["/confect/account.impl.ts", "/confect/uploadHttp.ts"].some(path => file.endsWith(path))))
          context.report({ node, messageId: "boundary" });
      },
    })),
    "bounded-effect-reads": rule("Confect Effect implementations must use bounded reads or pagination; document an exceptional bound at the call site.", context => ({
      CallExpression(node) { if (member(node.callee, "collect")) context.report({ node, messageId: "boundary" }); },
    })),
    "server-direction": rule("Server capabilities must not import framework action adapters; import a server workflow/service instead.", context => ({
      ImportDeclaration(node) {
        if (typeof node.source.value === "string" && /(?:@\/|(?:\.\.\/)+)app\/actions(?:\/|$)/.test(node.source.value))
          context.report({ node, messageId: "boundary" });
      },
    })),
    "shared-provider-runtime": rule("Use runInference at web workflow boundaries instead of rebuilding GeminiLive per call.", context => {
      const effects = new Set();
      const providers = new Set();
      return {
        ImportDeclaration(node) {
          for (const spec of node.specifiers) {
            if (spec.type !== "ImportSpecifier") continue;
            if (node.source.value === "effect" && spec.imported.name === "Effect") effects.add(spec.local.name);
            if (String(node.source.value).endsWith("GeminiService") && spec.imported.name === "GeminiLive") providers.add(spec.local.name);
          }
        },
        CallExpression(node) {
          if (member(node.callee, "provide") && effects.has(node.callee.object.name) && node.arguments.some(arg => arg.type === "Identifier" && providers.has(arg.name)))
            context.report({ node, messageId: "boundary" });
        },
      };
    }),
  },
};

export default plugin;

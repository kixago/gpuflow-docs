// src/lib/remark-limits.mjs
//
// Fills %group.key% tokens in the text of every docs page (limits.mjs).
// Code is left alone.
import { fill } from "./limits.mjs";

export default function remarkLimits() {
  return (tree, file) => {
    const visit = (node) => {
      if (node.type === "code" || node.type === "inlineCode") return;
      if (node.type === "text" && node.value.includes("%")) {
        try {
          node.value = fill(node.value);
        } catch (e) {
          throw new Error(`${file.path}: ${e.message}`);
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

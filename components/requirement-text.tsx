import { Fragment, type ReactNode } from "react";
import type { RequirementTree } from "@/lib/catalogue/types";

/** A requirement in plain words with every and and or spelled out: "COMP 250 and (MATH 235 or MATH 240)". `leaf` draws each course code. */
export function RequirementText({
  tree,
  leaf,
  nested = false,
}: {
  tree: RequirementTree;
  leaf: (code: string) => ReactNode;
  nested?: boolean;
}) {
  if (typeof tree === "string") return leaf(tree);
  const [word, children] =
    "and" in tree ? (["and", tree.and] as const) : (["or", tree.or] as const);
  const parts = children.map((child, i) => (
    <Fragment key={JSON.stringify(child)}>
      {i === 0 ? "" : i === children.length - 1 ? ` ${word} ` : ", "}
      <RequirementText tree={child} leaf={leaf} nested />
    </Fragment>
  ));
  return nested ? <>({parts})</> : parts;
}

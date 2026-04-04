import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCondition,
  createContext,
  createRule,
  createRuleSet,
} from "../src/lib/factory";
import {
  createOperatorRegistry,
  mergeWithDefaultOperators,
  OperatorRegistry,
} from "../src/lib/operators";
import { cond, condValuePath, group } from "./helpers";
import type { IContext, IRule, IRuleSet } from "../src/lib/types";

const ctx = (input: Record<string, unknown>): IContext => ({ input });

describe("eq and neq strictness", () => {
  it("distinguishes 0 from false and empty string", () => {
    assert.equal(createCondition(cond("$.n", "eq", 0)).evaluate(ctx({ n: 0 })), true);
    assert.equal(createCondition(cond("$.n", "eq", 0)).evaluate(ctx({ n: false })), false);
    assert.equal(createCondition(cond("$.n", "eq", 0)).evaluate(ctx({ n: "" })), false);
    assert.equal(createCondition(cond("$.n", "eq", false)).evaluate(ctx({ n: false })), true);
  });

  it("NaN is never eq to NaN", () => {
    assert.equal(
      createCondition(cond("$.x", "eq", Number.NaN)).evaluate(
        ctx({ x: Number.NaN }),
      ),
      false,
    );
    assert.equal(
      createCondition(cond("$.x", "neq", Number.NaN)).evaluate(
        ctx({ x: Number.NaN }),
      ),
      true,
    );
  });

  it("same array reference matches with eq", () => {
    const ref = [1, 2];
    assert.equal(
      createCondition(cond("$.a", "eq", ref)).evaluate(ctx({ a: ref })),
      true,
    );
    assert.equal(
      createCondition(cond("$.a", "eq", [1, 2])).evaluate(ctx({ a: [1, 2] })),
      false,
    );
  });
});

describe("missing and undefined paths", () => {
  it("missing nested segment yields undefined for field", () => {
    assert.equal(
      createCondition(cond("$.a.b", "eq", undefined)).evaluate(ctx({})),
      true,
    );
    assert.equal(
      createCondition(cond("$.a.b", "eq", 1)).evaluate(ctx({ a: {} })),
      false,
    );
  });

  it("valuePath missing resolves to undefined", () => {
    assert.equal(
      createCondition(condValuePath("$.x", "eq", "$.missing")).evaluate(
        ctx({ x: undefined }),
      ),
      true,
    );
    assert.equal(
      createCondition(condValuePath("$.x", "eq", "$.missing")).evaluate(
        ctx({ x: 1 }),
      ),
      false,
    );
  });
});

describe("relational operators on edge values", () => {
  it("compares false and 0 with gt", () => {
    assert.equal(createCondition(cond("$.a", "gt", 0)).evaluate(ctx({ a: false })), false);
    assert.equal(createCondition(cond("$.a", "gte", 0)).evaluate(ctx({ a: false })), true);
  });

  it("NaN comparisons are false for gt", () => {
    assert.equal(
      createCondition(cond("$.a", "gt", 1)).evaluate(ctx({ a: Number.NaN })),
      false,
    );
  });
});

describe("nany and none with empty RHS", () => {
  it("nany is true when list is empty", () => {
    assert.equal(
      createCondition(cond("$.k", "nany", [])).evaluate(ctx({ k: 1 })),
      true,
    );
  });

  it("none matches empty list semantics", () => {
    assert.equal(
      createCondition(cond("$.k", "none", [])).evaluate(ctx({ k: 99 })),
      true,
    );
  });
});

describe("groups with single child", () => {
  it("and with one leaf matches that leaf", () => {
    assert.equal(
      createCondition(group("and", [cond("$.x", "eq", 1)])).evaluate(ctx({ x: 1 })),
      true,
    );
  });

  it("or with one leaf matches that leaf", () => {
    assert.equal(
      createCondition(group("or", [cond("$.x", "eq", 2)])).evaluate(ctx({ x: 2 })),
      true,
    );
  });
});

describe("prototype and inherited keys on input", () => {
  it("in operator sees inherited string keys on input object", () => {
    const input = Object.create({ protoKey: 42 });
    (input as Record<string, unknown>).own = 1;
    assert.equal(
      createCondition(cond("protoKey", "eq", 42)).evaluate(ctx(input)),
      true,
    );
  });
});

describe("numeric and unusual property names", () => {
  it("field string 1 matches input[1]", () => {
    assert.equal(
      createCondition(cond("1", "eq", "one")).evaluate(
        ctx({ "1": "one" } as Record<string, unknown>),
      ),
      true,
    );
  });

  it("unicode key as direct field", () => {
    assert.equal(
      createCondition(cond("café", "eq", 3)).evaluate(ctx({ café: 3 })),
      true,
    );
  });
});

describe("context passed to custom operators", () => {
  it("exposes full IContext including non-input keys", () => {
    const operators = createOperatorRegistry({
      usesMeta: ({ context }) => context.meta === "yes",
    });
    const c = createCondition(cond("$.x", "usesMeta", 0), { operators });
    const full: IContext = { input: { x: 1 }, meta: "yes" };
    assert.equal(c.evaluate(full), true);
    assert.equal(c.evaluate({ input: { x: 1 } }), false);
  });
});

describe("operator registry edge cases", () => {
  it("last register wins for duplicate name", () => {
    const r = new OperatorRegistry();
    r.register("dup", () => false);
    r.register("dup", () => true);
    assert.equal(r.evaluate("dup", {} as never), true);
  });

  it("merge overlays default eq", () => {
    const custom = createOperatorRegistry({
      eq: () => false,
    });
    const merged = mergeWithDefaultOperators(custom);
    assert.equal(
      merged.evaluate("eq", {
        fieldValue: 1,
        value: 1,
        condition: cond("$.x", "eq", 1),
        context: ctx({}),
      }),
      false,
    );
    assert.equal(
      merged.evaluate("neq", {
        fieldValue: 1,
        value: 2,
        condition: cond("$.x", "neq", 2),
        context: ctx({}),
      }),
      true,
    );
  });
});

describe("rule and ruleset edge cases", () => {
  it("permissive rule with empty conditions is true", () => {
    const rule: IRule = { id: "e", type: "permissive", conditions: [] };
    assert.equal(createRule(rule).evaluate(createContext({})), true);
  });

  it("restrictive rule with empty conditions throws", () => {
    const rule: IRule = { id: "e", type: "restrictive", conditions: [] };
    assert.throws(() => createRule(rule).evaluate(createContext({})), /Invalid rule type/);
  });

  it("ruleset with empty rules array is true", () => {
    const set: IRuleSet = { id: "empty", rules: [] };
    assert.equal(createRuleSet(set).evaluate(createContext({})), true);
  });
});

describe("invalid RHS shapes for array or string operators", () => {
  it("contains throws when value is not array-like with includes", () => {
    const c = createCondition(cond("$.k", "contains", 1 as unknown as number[]));
    assert.throws(() => c.evaluate(ctx({ k: 1 })), TypeError);
  });

  it("any throws when value is not array-like", () => {
    const c = createCondition(cond("$.k", "any", "nope" as unknown as number[]));
    assert.throws(() => c.evaluate(ctx({ k: 1 })), TypeError);
  });

  it("ncontains throws when fieldValue is not string-like with includes", () => {
    const c = createCondition(cond("$.k", "ncontains", "x"));
    assert.throws(() => c.evaluate(ctx({ k: 42 })), TypeError);
  });
});

describe("not group edge cases", () => {
  it("not with empty children is true", () => {
    assert.equal(createCondition(group("not", [])).evaluate(ctx({})), true);
  });
});

describe("valuePath when JSONPath RHS misses", () => {
  it("compares field to undefined when valuePath has no match", () => {
    assert.equal(
      createCondition(condValuePath("$.x", "eq", "$.no.such.path")).evaluate(
        ctx({ x: undefined }),
      ),
      true,
    );
  });
});

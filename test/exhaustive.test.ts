import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCondition,
  createContext,
  createRule,
  createRuleSet,
} from "../src/lib/factory";
import { createOperatorRegistry } from "../src/lib/operators";
import { cond, condValuePath, group } from "./helpers";
import type { IContext, IRule, IRuleSet } from "../src/lib/types";

const ctx = (input: Record<string, unknown>): IContext => ({ input });

describe("paths: direct keys vs $ paths", () => {
  it("reads root property when field matches input key without $", () => {
    assert.equal(
      createCondition(cond("status", "eq", "ok")).evaluate(
        ctx({ status: "ok" }),
      ),
      true,
    );
  });

  it("plain field missing falls through to parser and errors if not JSONPath-shaped", () => {
    assert.throws(
      () =>
        createCondition(cond("status", "eq", "ok")).evaluate(ctx({ other: 1 })),
      /JSONPath must start with/,
    );
  });

  it("falls back to JSONPath when field string is not own property", () => {
    assert.equal(
      createCondition(cond("$.user.id", "eq", 7)).evaluate(
        ctx({ user: { id: 7 } }),
      ),
      true,
    );
  });

  it("valuePath uses direct key when present on input", () => {
    assert.equal(
      createCondition(condValuePath("$.a", "eq", "limit")).evaluate(
        ctx({ a: 100, limit: 100 }),
      ),
      true,
    );
  });
});

describe("valuePath coverage", () => {
  it("compares two JSONPath fields", () => {
    assert.equal(
      createCondition(condValuePath("$.x", "eq", "$.y")).evaluate(
        ctx({ x: 1, y: 1 }),
      ),
      true,
    );
    assert.equal(
      createCondition(condValuePath("$.x", "eq", "$.y")).evaluate(
        ctx({ x: 1, y: 2 }),
      ),
      false,
    );
  });

  it("works inside createRule", () => {
    const rule: IRule = {
      id: "vp",
      type: "permissive",
      conditions: [condValuePath("$.password", "eq", "passwordConfirm")],
    };
    const r = createRule(rule);
    assert.equal(
      r.evaluate(ctx({ password: "x", passwordConfirm: "x" })),
      true,
    );
    assert.equal(
      r.evaluate(ctx({ password: "x", passwordConfirm: "y" })),
      false,
    );
  });

  it("works in nested groups with mixed value and valuePath leaves", () => {
    const g = createCondition(
      group("and", [cond("$.a", "eq", 1), condValuePath("$.b", "eq", "c")]),
    );
    assert.equal(g.evaluate(ctx({ a: 1, b: 2, c: 2 })), true);
    assert.equal(g.evaluate(ctx({ a: 1, b: 2, c: 3 })), false);
  });
});

describe("literals and eq", () => {
  it("treats explicit undefined as comparable value", () => {
    assert.equal(
      createCondition(cond("$.x", "eq", undefined)).evaluate(ctx({})),
      true,
    );
    assert.equal(
      createCondition(cond("$.x", "eq", undefined)).evaluate(ctx({ x: 1 })),
      false,
    );
  });

  it("distinguishes null from undefined", () => {
    assert.equal(
      createCondition(cond("$.x", "eq", null)).evaluate(ctx({ x: null })),
      true,
    );
    assert.equal(
      createCondition(cond("$.x", "eq", null)).evaluate(ctx({ x: undefined })),
      false,
    );
  });
});

describe("relational operators", () => {
  it("coerces string and number for ordering", () => {
    assert.equal(
      createCondition(cond("$.a", "gt", 5)).evaluate(ctx({ a: "10" })),
      true,
    );
    assert.equal(
      createCondition(cond("$.a", "lt", "20")).evaluate(ctx({ a: 10 })),
      true,
    );
  });
});

describe("array operators", () => {
  it("contains requires array-like value with includes", () => {
    assert.equal(
      createCondition(cond("$.k", "contains", [1, 2, 3])).evaluate(
        ctx({ k: 2 }),
      ),
      true,
    );
  });

  it("any with empty array is false", () => {
    assert.equal(
      createCondition(cond("$.k", "any", [])).evaluate(ctx({ k: 1 })),
      false,
    );
  });

  it("all with empty array is true", () => {
    assert.equal(
      createCondition(cond("$.k", "all", [])).evaluate(ctx({ k: 1 })),
      true,
    );
  });

  it("none with empty array is true", () => {
    assert.equal(
      createCondition(cond("$.k", "none", [])).evaluate(ctx({ k: 1 })),
      true,
    );
  });
});

describe("not group", () => {
  it("is false when any child matches", () => {
    const g = createCondition(
      group("not", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
    );
    assert.equal(g.evaluate(ctx({ a: 9, b: 2 })), false);
    assert.equal(g.evaluate(ctx({ a: 9, b: 9 })), true);
  });
});

describe("deep nesting", () => {
  it("evaluates and-or-and chain", () => {
    const tree = group("and", [
      cond("$.x", "eq", 1),
      group("or", [
        group("and", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
        cond("$.flag", "eq", true),
      ]),
    ]);
    const e = createCondition(tree);
    assert.equal(e.evaluate(ctx({ x: 1, a: 1, b: 2 })), true);
    assert.equal(e.evaluate(ctx({ x: 1, a: 0, b: 0, flag: true })), true);
    assert.equal(e.evaluate(ctx({ x: 1, a: 0, b: 0, flag: false })), false);
  });
});

describe("rule instance reuse", () => {
  it("returns consistent results across many contexts", () => {
    const rule = createRule({
      id: "reuse",
      type: "permissive",
      conditions: [cond("$.n", "eq", 1), condValuePath("$.a", "eq", "$.b")],
    });
    for (let i = 0; i < 50; i++) {
      assert.equal(rule.evaluate(ctx({ n: 1, a: i, b: i })), true);
      assert.equal(rule.evaluate(ctx({ n: 2, a: i, b: i })), false);
    }
  });
});

describe("createRuleSet", () => {
  it("fails when any sibling rule fails", () => {
    const set: IRuleSet = {
      id: "s",
      rules: [
        { id: "r1", type: "permissive", conditions: [cond("$.x", "eq", 1)] },
        { id: "r2", type: "permissive", conditions: [cond("$.y", "eq", 2)] },
      ],
    };
    const rs = createRuleSet(set);
    assert.equal(rs.evaluate(ctx({ x: 1, y: 2 })), true);
    assert.equal(rs.evaluate(ctx({ x: 1, y: 0 })), false);
  });

  it("nested rule set with valuePath leaf", () => {
    const inner: IRuleSet = {
      id: "in",
      rules: [
        {
          id: "r",
          type: "permissive",
          conditions: [condValuePath("$.u", "eq", "v")],
        },
      ],
    };
    const outer: IRuleSet = { id: "out", rules: [inner] };
    assert.equal(createRuleSet(outer).evaluate(ctx({ u: 3, v: 3 })), true);
    assert.equal(createRuleSet(outer).evaluate(ctx({ u: 3, v: 4 })), false);
  });
});

describe("custom operators with valuePath", () => {
  it("receives resolved RHS from valuePath not the path string", () => {
    const operators = createOperatorRegistry({
      sameRef: ({ fieldValue, value }) => fieldValue === value,
    });
    const c = createCondition(condValuePath("$.left", "sameRef", "right"), {
      operators,
    });
    assert.equal(c.evaluate(ctx({ left: 42, right: 42 })), true);
    assert.equal(c.evaluate(ctx({ left: 42, right: 41 })), false);
  });
});

describe("duplicate path strings across leaves", () => {
  it("evaluates when multiple leaves share the same field path", () => {
    const g = createCondition(
      group("and", [cond("$.a", "gte", 0), cond("$.a", "lte", 10)]),
    );
    assert.equal(g.evaluate(ctx({ a: 5 })), true);
    assert.equal(g.evaluate(ctx({ a: 11 })), false);
  });
});

describe("permissive rule edge cases", () => {
  it("empty conditions uses every([]) as true", () => {
    const rule: IRule = {
      id: "empty",
      type: "permissive",
      conditions: [],
    };
    assert.equal(createRule(rule).evaluate(createContext({})), true);
  });

  it("single top-level group", () => {
    const rule: IRule = {
      id: "oneg",
      type: "permissive",
      conditions: [group("or", [cond("$.x", "eq", 1), cond("$.x", "eq", 2)])],
    };
    assert.equal(createRule(rule).evaluate(ctx({ x: 2 })), true);
  });
});

describe("restrictive rule", () => {
  it("multiple conditions: true when any fails; throws when all pass", () => {
    const rule: IRule = {
      id: "r",
      type: "restrictive",
      conditions: [cond("$.a", "eq", 1), cond("$.b", "eq", 2)],
    };
    const r = createRule(rule);
    assert.equal(r.evaluate(ctx({ a: 2, b: 2 })), true);
    assert.throws(() => r.evaluate(ctx({ a: 1, b: 2 })), /Invalid rule type/);
  });
});

describe("OperatorRegistry.merge behavior via createRule", () => {
  it("custom registry still exposes default eq", () => {
    const operators = createOperatorRegistry({
      isOne: ({ fieldValue }) => fieldValue === 1,
    });
    const rule: IRule = {
      id: "m",
      type: "permissive",
      conditions: [cond("$.x", "isOne", true), cond("$.y", "eq", 2)],
    };
    assert.equal(
      createRule(rule, { operators }).evaluate(ctx({ x: 1, y: 2 })),
      true,
    );
    assert.equal(
      createRule(rule, { operators }).evaluate(ctx({ x: 2, y: 2 })),
      false,
    );
  });
});

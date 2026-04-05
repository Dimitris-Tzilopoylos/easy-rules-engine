import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCondition } from "../src/lib/factory";
import { createOperatorRegistry } from "../src/lib/operators";
import { cond, condValuePath, group } from "./helpers";
import type { IBaseCondition, IContext } from "../src/lib/types";

const ctx = (input: Record<string, unknown>): IContext => ({ input });

describe("Condition", () => {
  it("eq matches when field equals value", () => {
    const c = createCondition(cond("$.n", "eq", 1));
    assert.equal(c.evaluate(ctx({ n: 1 })), true);
    assert.equal(c.evaluate(ctx({ n: 2 })), false);
  });

  it("neq matches when field differs", () => {
    const c = createCondition(cond("$.n", "neq", 1));
    assert.equal(c.evaluate(ctx({ n: 2 })), true);
    assert.equal(c.evaluate(ctx({ n: 1 })), false);
  });

  it("gt / gte / lt / lte compare numbers", () => {
    assert.equal(createCondition(cond("$.x", "gt", 5)).evaluate(ctx({ x: 10 })), true);
    assert.equal(createCondition(cond("$.x", "gte", 10)).evaluate(ctx({ x: 10 })), true);
    assert.equal(createCondition(cond("$.x", "lt", 5)).evaluate(ctx({ x: 3 })), true);
    assert.equal(createCondition(cond("$.x", "lte", 5)).evaluate(ctx({ x: 5 })), true);
  });

  it("contains checks value.includes(fieldValue)", () => {
    const c = createCondition(cond("$.tag", "contains", ["a", "b", "c"]));
    assert.equal(c.evaluate(ctx({ tag: "b" })), true);
    assert.equal(c.evaluate(ctx({ tag: "z" })), false);
  });

  it("any / all on arrays", () => {
    assert.equal(
      createCondition(cond("$.x", "any", [1, 2, 3])).evaluate(ctx({ x: 2 })),
      true,
    );
    assert.equal(
      createCondition(cond("$.x", "all", [2, 2, 2])).evaluate(ctx({ x: 2 })),
      true,
    );
    assert.equal(
      createCondition(cond("$.x", "none", [1, 3])).evaluate(ctx({ x: 2 })),
      true,
    );
  });

  it("nany is true when field value is not in the list", () => {
    assert.equal(
      createCondition(cond("$.x", "nany", [1, 3, 5])).evaluate(ctx({ x: 2 })),
      true,
    );
    assert.equal(
      createCondition(cond("$.x", "nany", [1, 3, 5])).evaluate(ctx({ x: 3 })),
      false,
    );
  });

  it("ncontains on string field", () => {
    assert.equal(
      createCondition(cond("$.s", "ncontains", "bad")).evaluate(ctx({ s: "hello" })),
      true,
    );
    assert.equal(
      createCondition(cond("$.s", "ncontains", "ell")).evaluate(ctx({ s: "hello" })),
      false,
    );
  });
});

describe("Extended built-in operators", () => {
  it("in / nin use Array.includes semantics", () => {
    assert.equal(createCondition(cond("$.x", "in", [1, 2, 3])).evaluate(ctx({ x: 2 })), true);
    assert.equal(createCondition(cond("$.x", "in", [1, 2, 3])).evaluate(ctx({ x: 4 })), false);
    assert.equal(createCondition(cond("$.x", "nin", [1, 2, 3])).evaluate(ctx({ x: 4 })), true);
    assert.equal(createCondition(cond("$.x", "nin", [1, 2, 3])).evaluate(ctx({ x: 2 })), false);
    assert.equal(
      createCondition(cond("$.x", "in", [Number.NaN])).evaluate(ctx({ x: Number.NaN })),
      true,
    );
  });

  it("startsWith and endsWith", () => {
    assert.equal(
      createCondition(cond("$.s", "startsWith", "hel")).evaluate(ctx({ s: "hello" })),
      true,
    );
    assert.equal(
      createCondition(cond("$.s", "endsWith", "lo")).evaluate(ctx({ s: "hello" })),
      true,
    );
    assert.equal(
      createCondition(cond("$.s", "startsWith", "no")).evaluate(ctx({ s: "hello" })),
      false,
    );
  });

  it("matches applies regex pattern string", () => {
    assert.equal(
      createCondition(cond("$.s", "matches", "^[a-z]+$")).evaluate(ctx({ s: "abc" })),
      true,
    );
    assert.equal(
      createCondition(cond("$.s", "matches", "^[0-9]+$")).evaluate(ctx({ s: "abc" })),
      false,
    );
    assert.equal(
      createCondition(cond("$.s", "matches", "(")).evaluate(ctx({ s: "x" })),
      false,
    );
  });

  it("between is inclusive on numeric endpoints", () => {
    assert.equal(
      createCondition(cond("$.n", "between", [10, 20])).evaluate(ctx({ n: 15 })),
      true,
    );
    assert.equal(
      createCondition(cond("$.n", "between", [10, 20])).evaluate(ctx({ n: 10 })),
      true,
    );
    assert.equal(
      createCondition(cond("$.n", "between", [10, 20])).evaluate(ctx({ n: 9 })),
      false,
    );
    assert.equal(
      createCondition(cond("$.n", "between", [10])).evaluate(ctx({ n: 15 })),
      false,
    );
  });

  it("defined blank notBlank", () => {
    assert.equal(createCondition(cond("$.x", "defined", null)).evaluate(ctx({ x: 0 })), true);
    assert.equal(createCondition(cond("$.x", "defined", null)).evaluate(ctx({})), false);
    assert.equal(createCondition(cond("$.x", "blank", null)).evaluate(ctx({ x: "" })), true);
    assert.equal(createCondition(cond("$.x", "blank", null)).evaluate(ctx({ x: [] })), true);
    assert.equal(createCondition(cond("$.x", "blank", null)).evaluate(ctx({ x: {} })), true);
    assert.equal(createCondition(cond("$.x", "notBlank", null)).evaluate(ctx({ x: "a" })), true);
    assert.equal(createCondition(cond("$.x", "notBlank", null)).evaluate(ctx({ x: "" })), false);
  });

  it("isOfType uses JavaScript typeof string", () => {
    assert.equal(
      createCondition(cond("$.x", "isOfType", "number")).evaluate(ctx({ x: 1 })),
      true,
    );
    assert.equal(
      createCondition(cond("$.x", "isOfType", "string")).evaluate(ctx({ x: 1 })),
      false,
    );
    assert.equal(
      createCondition(cond("$.x", "isOfType", "object")).evaluate(ctx({ x: null })),
      true,
    );
  });
});

describe("ConditionGroup", () => {
  it("and requires all children", () => {
    const g = createCondition(
      group("and", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
    );
    assert.equal(g.evaluate(ctx({ a: 1, b: 2 })), true);
    assert.equal(g.evaluate(ctx({ a: 1, b: 0 })), false);
  });

  it("or requires any child", () => {
    const g = createCondition(
      group("or", [cond("$.a", "eq", 9), cond("$.b", "eq", 2)]),
    );
    assert.equal(g.evaluate(ctx({ a: 0, b: 2 })), true);
    assert.equal(g.evaluate(ctx({ a: 0, b: 0 })), false);
  });

  it("not negates some-match", () => {
    const g = createCondition(group("not", [cond("$.x", "eq", 1)]));
    assert.equal(g.evaluate(ctx({ x: 2 })), true);
    assert.equal(g.evaluate(ctx({ x: 1 })), false);
  });
});

describe("createCondition", () => {
  it("builds evaluable from condition or group shape", () => {
    assert.equal(createCondition(cond("$.x", "eq", 1)).evaluate(ctx({ x: 1 })), true);
    assert.equal(
      createCondition(group("and", [cond("$.x", "eq", 1)])).evaluate(ctx({ x: 1 })),
      true,
    );
  });

  it("throws when base condition has neither value nor valuePath", () => {
    assert.throws(
      () =>
        createCondition({
          field: "$.x",
          operator: "eq",
        } as IBaseCondition),
      /Invalid condition/,
    );
  });

  it("throws when base condition has both value and valuePath", () => {
    assert.throws(
      () =>
        createCondition({
          field: "$.x",
          operator: "eq",
          value: 1,
          valuePath: "y",
        } as IBaseCondition),
      /Invalid condition/,
    );
  });

  it("resolves valuePath from input like field (literal key vs path)", () => {
    assert.equal(
      createCondition(condValuePath("$.a", "eq", "b")).evaluate(
        ctx({ a: 1, b: 1 }),
      ),
      true,
    );
    assert.equal(
      createCondition(condValuePath("$.a", "eq", "$.b")).evaluate(
        ctx({ a: 1, b: 2 }),
      ),
      false,
    );
    assert.equal(
      createCondition(condValuePath("$.nested.a", "eq", "ref")).evaluate(
        ctx({ nested: { a: 5 }, ref: 5 }),
      ),
      true,
    );
  });
});

describe("OperatorRegistry", () => {
  it("merges custom operators with defaults (only custom registry)", () => {
    const operators = createOperatorRegistry({
      startsWith: ({ fieldValue, value }) =>
        typeof fieldValue === "string" &&
        typeof value === "string" &&
        fieldValue.startsWith(value),
    });
    const c = createCondition(cond("$.name", "startsWith", "Al"), { operators });
    assert.equal(c.evaluate(ctx({ name: "Alice" })), true);
    assert.equal(c.evaluate(ctx({ name: "Bob" })), false);
    assert.equal(
      createCondition(cond("$.n", "eq", 1), { operators }).evaluate(ctx({ n: 1 })),
      true,
    );
  });

  it("throws for unknown operators", () => {
    const c = createCondition(cond("$.x", "notAnOperator", 1));
    assert.throws(() => c.evaluate(ctx({ x: 1 })), /Unknown condition operator/);
  });

  it("rejects reserved group operator names", () => {
    assert.throws(
      () => createOperatorRegistry({ and: () => true }),
      /reserved/,
    );
  });
});

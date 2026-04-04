import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCondition } from "../src/lib/factory";
import { createOperatorRegistry } from "../src/lib/operators";
import { cond, group } from "./helpers";
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

  it("throws when base condition has no value", () => {
    assert.throws(
      () =>
        createCondition({
          field: "$.x",
          operator: "eq",
        } as IBaseCondition),
      /Invalid condition/,
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

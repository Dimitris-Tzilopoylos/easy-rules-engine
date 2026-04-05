import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  conditionSchema,
  createCondition,
  createContext,
  createEvaluable,
  createOperatorRegistry,
  createRule,
  createRuleSet,
  OperatorRegistry,
  parseRule,
  safeParseCreateContextArgument,
  safeParseRule,
  safeParseRuleSet,
} from "../src/index";
import { assertEvalParity, cond, group } from "./helpers";
import {
  apiStyleRuleJson,
  minimalPermissiveRule,
  minimalRuleSet,
} from "./fixtures/engineFixtures";
import type { IRule, KnownConditionOperator } from "../src/lib/types";

describe("Contract: evaluate vs evaluateAsync", () => {
  it("permissive rule: pass and fail", async () => {
    const rule: IRule = {
      id: "c1",
      type: "permissive",
      conditions: [cond("$.a", "eq", 1), cond("$.b", "eq", 2)],
    };
    const e = createRule(rule);
    await assertEvalParity(e, createContext({ a: 1, b: 2 }), true);
    await assertEvalParity(e, createContext({ a: 1, b: 0 }), false);
  });

  it("restrictive rule: fail branch and pass branch", async () => {
    const rule: IRule = {
      id: "c2",
      type: "restrictive",
      conditions: [cond("$.a", "eq", 1)],
    };
    const e = createRule(rule);
    await assertEvalParity(e, createContext({ a: 2 }), true);
    await assertEvalParity(e, createContext({ a: 0 }), true);
  });

  it("rule set: all children must pass", async () => {
    const e = createRuleSet({
      id: "s",
      rules: [
        {
          id: "r1",
          type: "permissive",
          conditions: [cond("$.x", "eq", 1)],
        },
        {
          id: "r2",
          type: "permissive",
          conditions: [cond("$.y", "eq", 2)],
        },
      ],
    });
    await assertEvalParity(e, createContext({ x: 1, y: 2 }), true);
    await assertEvalParity(e, createContext({ x: 1, y: 0 }), false);
  });

  it("createEvaluable + nested set", async () => {
    const e = createEvaluable(minimalRuleSet());
    await assertEvalParity(e, createContext({}), true);
  });

  it("createCondition leaf + group", async () => {
    const leaf = createCondition(cond("$.n", "eq", 5));
    await assertEvalParity(leaf, createContext({ n: 5 }), true);
    const g = createCondition(
      group("and", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
    );
    await assertEvalParity(g, createContext({ a: 1, b: 2 }), true);
    await assertEvalParity(g, createContext({ a: 1, b: 0 }), false);
  });

  it("deeply nested and/or groups: parity", async () => {
    const g = createCondition(
      group("and", [
        cond("$.region", "eq", "eu"),
        group("or", [
          group("and", [
            cond("$.role", "eq", "admin"),
            cond("$.tier", "eq", "gold"),
          ]),
          group("and", [
            cond("$.role", "eq", "user"),
            cond("$.tier", "eq", "gold"),
          ]),
        ]),
      ]),
    );
    await assertEvalParity(
      g,
      createContext({ region: "eu", role: "admin", tier: "gold" }),
      true,
    );
    await assertEvalParity(
      g,
      createContext({ region: "eu", role: "user", tier: "gold" }),
      true,
    );
    await assertEvalParity(
      g,
      createContext({ region: "us", role: "admin", tier: "gold" }),
      false,
    );
    await assertEvalParity(
      g,
      createContext({ region: "eu", role: "user", tier: "silver" }),
      false,
    );
  });

});

describe("Contract: Zod safeParse error shape", () => {
  it("safeParseRule missing id reports path id", () => {
    const r = safeParseRule({ type: "permissive", conditions: [] });
    assert.equal(r.success, false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      assert.ok(paths.some((p) => p === "id"), `expected id in paths, got ${paths.join(",")}`);
    }
  });

  it("safeParseRuleSet missing id reports path id", () => {
    const r = safeParseRuleSet({ rules: [] });
    assert.equal(r.success, false);
    if (!r.success) {
      assert.ok(
        r.error.issues.some((i) => i.path[0] === "id"),
        JSON.stringify(r.error.issues),
      );
    }
  });

  it("safeParseCreateContextArgument rejects array", () => {
    const r = safeParseCreateContextArgument([]);
    assert.equal(r.success, false);
  });

  it("createRule throws ZodError with issues array", () => {
    try {
      createRule({ type: "permissive", conditions: [] });
      assert.fail("expected throw");
    } catch (e) {
      assert.ok(e instanceof ZodError);
      assert.ok(Array.isArray((e as ZodError).issues));
      assert.ok((e as ZodError).issues.length > 0);
    }
  });
});

describe("Contract: parse then construct equals create*", () => {
  it("createRule(raw) matches new Rule(parseRule(raw))", () => {
    const raw = apiStyleRuleJson();
    const a = createRule(raw);
    const b = createRule(parseRule(raw));
    const ctx = createContext({
      status: "active",
      score: 15,
      role: "user",
    });
    assert.equal(a.evaluate(ctx), b.evaluate(ctx));
    assert.equal(a.evaluate(ctx), true);
  });

  it("JSON round-trip preserves evaluation", () => {
    const rule = minimalPermissiveRule("rt");
    rule.conditions = [cond("$.k", "eq", true)];
    const wire = JSON.parse(JSON.stringify(rule)) as unknown;
    const e = createRule(wire);
    assert.equal(e.evaluate(createContext({ k: true })), true);
  });
});

describe("Contract: all KnownConditionOperator names accepted by conditionSchema", () => {
  const KNOWN: Array<{ op: KnownConditionOperator; value: unknown }> = [
    { op: "eq", value: 1 },
    { op: "neq", value: 1 },
    { op: "gt", value: 0 },
    { op: "gte", value: 0 },
    { op: "lt", value: 10 },
    { op: "lte", value: 10 },
    { op: "contains", value: "hello" },
    { op: "ncontains", value: "bad" },
    { op: "all", value: [2, 2, 2] },
    { op: "any", value: [1, 2, 3] },
    { op: "nany", value: [1, 3] },
    { op: "none", value: [1, 3] },
    { op: "in", value: [1, 2, 3] },
    { op: "nin", value: [1, 2, 3] },
    { op: "startsWith", value: "ab" },
    { op: "endsWith", value: "bc" },
    { op: "matches", value: "^a" },
    { op: "between", value: [0, 10] },
    { op: "defined", value: null },
    { op: "blank", value: null },
    { op: "notBlank", value: null },
    { op: "isOfType", value: "string" },
  ];

  for (const { op, value } of KNOWN) {
    it(`conditionSchema accepts operator ${op}`, () => {
      const r = conditionSchema.safeParse({
        field: "x",
        operator: op,
        value,
      });
      assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
    });
  }
});

describe("Contract: restrictive rule async path", () => {
  it("evaluateAsync rejects when all conditions pass (same as evaluate)", async () => {
    const e = createRule({
      id: "r",
      type: "restrictive",
      conditions: [cond("$.a", "eq", 1)],
    });
    const ctx = createContext({ a: 1 });
    assert.throws(() => e.evaluate(ctx), /Invalid rule type/);
    await assert.rejects(e.evaluateAsync(ctx), /Invalid rule type/);
  });
});

describe("Contract: OperatorRegistry invariants", () => {
  it("register and, or, not throws", () => {
    for (const name of ["and", "or", "not"] as const) {
      const r = new OperatorRegistry();
      assert.throws(() => r.register(name, () => true), /reserved/i);
    }
  });

  it("custom registry merges with defaults via createRule options", () => {
    const custom = createOperatorRegistry({
      onlyFoo: ({ fieldValue }) => fieldValue === "foo",
    });
    const e = createRule(
      {
        id: "r",
        type: "permissive",
        conditions: [
          { field: "a", operator: "onlyFoo", value: null },
          { field: "b", operator: "eq", value: 1 },
        ],
      },
      { operators: custom },
    );
    assert.equal(e.evaluate(createContext({ a: "foo", b: 1 })), true);
    assert.equal(e.evaluate(createContext({ a: "bar", b: 1 })), false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCondition,
  createContext,
  createEvaluable,
  createRule,
  createRuleSet,
} from "../src/lib/factory";
import { assertEvalParity, cond, group } from "./helpers";
import { deeplyNestedGroupsRuleJson } from "./fixtures/engineFixtures";
import type { IContext, IRule, IRuleSet } from "../src/lib/types";

const ctx = (input: Record<string, unknown>): IContext => ({ input });

describe("Nested condition groups", () => {
  it("and of or: (a=1 OR b=1) AND c=3", () => {
    const g = createCondition(
      group("and", [
        group("or", [cond("$.a", "eq", 1), cond("$.b", "eq", 1)]),
        cond("$.c", "eq", 3),
      ]),
    );
    assert.equal(g.evaluate(ctx({ a: 0, b: 1, c: 3 })), true);
    assert.equal(g.evaluate(ctx({ a: 0, b: 0, c: 3 })), false);
    assert.equal(g.evaluate(ctx({ a: 1, b: 0, c: 0 })), false);
  });

  it("or of and: (a AND b) OR (c AND d)", () => {
    const g = createCondition(
      group("or", [
        group("and", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
        group("and", [cond("$.c", "eq", 3), cond("$.d", "eq", 4)]),
      ]),
    );
    assert.equal(g.evaluate(ctx({ a: 1, b: 2, c: 0, d: 0 })), true);
    assert.equal(g.evaluate(ctx({ a: 0, b: 0, c: 3, d: 4 })), true);
    assert.equal(g.evaluate(ctx({ a: 1, b: 9, c: 3, d: 9 })), false);
  });

  it("three levels: AND -> OR -> AND", () => {
    const g = createCondition(
      group("and", [
        cond("$.region", "eq", "eu"),
        group("or", [
          group("and", [cond("$.role", "eq", "admin"), cond("$.tier", "eq", "gold")]),
          group("and", [cond("$.role", "eq", "user"), cond("$.tier", "eq", "gold")]),
        ]),
      ]),
    );
    assert.equal(g.evaluate(ctx({ region: "eu", role: "admin", tier: "gold" })), true);
    assert.equal(g.evaluate(ctx({ region: "eu", role: "user", tier: "gold" })), true);
    assert.equal(g.evaluate(ctx({ region: "us", role: "admin", tier: "gold" })), false);
    assert.equal(g.evaluate(ctx({ region: "eu", role: "user", tier: "silver" })), false);
  });

  it("not wrapping a nested and group", () => {
    const g = createCondition(
      group("not", [group("and", [cond("$.x", "eq", 1), cond("$.y", "eq", 2)])]),
    );
    assert.equal(g.evaluate(ctx({ x: 1, y: 2 })), false);
    assert.equal(g.evaluate(ctx({ x: 1, y: 9 })), true);
    assert.equal(g.evaluate(ctx({ x: 9, y: 2 })), true);
  });

  it("four levels of nesting with mixed operators", () => {
    const g = createCondition(
      group("or", [
        group("and", [
          cond("$.p", "eq", true),
          group("not", [
            group("or", [cond("$.q", "eq", 1), cond("$.q", "eq", 2)]),
          ]),
        ]),
        cond("$.bypass", "eq", "yes"),
      ]),
    );
    assert.equal(g.evaluate(ctx({ p: true, q: 3 })), true);
    assert.equal(g.evaluate(ctx({ p: true, q: 1 })), false);
    assert.equal(g.evaluate(ctx({ p: false, bypass: "yes" })), true);
  });

  it("five levels: OR → AND → NOT → OR → leaves", async () => {
    const g = createCondition(
      group("or", [
        group("and", [
          cond("$.a", "eq", 1),
          group("not", [
            group("or", [cond("$.b", "eq", 2), cond("$.b", "eq", 3)]),
          ]),
        ]),
        cond("$.c", "eq", "yes"),
      ]),
    );
    await assertEvalParity(g, createContext({ a: 1, b: 9, c: "no" }), true);
    await assertEvalParity(g, createContext({ a: 1, b: 2, c: "no" }), false);
    await assertEvalParity(g, createContext({ a: 0, c: "yes" }), true);
  });
});

describe("Nested groups: sync and async agree", () => {
  it("and-of-or matches four-level tree (evaluateAsync)", async () => {
    const g = createCondition(
      group("or", [
        group("and", [
          cond("$.p", "eq", true),
          group("not", [
            group("or", [cond("$.q", "eq", 1), cond("$.q", "eq", 2)]),
          ]),
        ]),
        cond("$.bypass", "eq", "yes"),
      ]),
    );
    await assertEvalParity(g, createContext({ p: true, q: 3 }), true);
    await assertEvalParity(g, createContext({ p: true, q: 1 }), false);
    await assertEvalParity(g, createContext({ p: false, bypass: "yes" }), true);
  });

  it("rule with nested groups (JSON paths)", async () => {
    const rule: IRule = {
      id: "nested-async",
      type: "permissive",
      conditions: [
        cond("$.enabled", "eq", true),
        group("or", [
          cond("$.env", "eq", "dev"),
          cond("$.env", "eq", "staging"),
        ]),
      ],
    };
    const r = createRule(rule);
    await assertEvalParity(r, createContext({ enabled: true, env: "dev" }), true);
    await assertEvalParity(r, createContext({ enabled: true, env: "prod" }), false);
  });

  it("createRule from fixture JSON (nested groups)", async () => {
    const raw: unknown = deeplyNestedGroupsRuleJson();
    const r = createRule(raw);
    await assertEvalParity(
      r,
      createContext({ region: "eu", role: "admin", tier: "gold" }),
      true,
    );
    await assertEvalParity(
      r,
      createContext({ region: "eu", role: "user", tier: "silver" }),
      false,
    );
  });
});

describe("Empty condition groups (documented JS semantics)", () => {
  it("empty and: every([]) is true", () => {
    assert.equal(createCondition(group("and", [])).evaluate(ctx({})), true);
  });

  it("empty or: some([]) is false", () => {
    assert.equal(createCondition(group("or", [])).evaluate(ctx({})), false);
  });

  it("empty not: !some([]) is true", () => {
    assert.equal(createCondition(group("not", [])).evaluate(ctx({})), true);
  });
});

describe("Rule with nested condition groups", () => {
  it("permissive rule with nested or inside top-level and", () => {
    const rule: IRule = {
      id: "nested",
      type: "permissive",
      conditions: [
        cond("$.enabled", "eq", true),
        group("or", [cond("$.env", "eq", "dev"), cond("$.env", "eq", "staging")]),
      ],
    };
    const r = createRule(rule);
    assert.equal(r.evaluate(createContext({ enabled: true, env: "dev" })), true);
    assert.equal(r.evaluate(createContext({ enabled: true, env: "prod" })), false);
    assert.equal(r.evaluate(createContext({ enabled: false, env: "dev" })), false);
  });

  it("multiple nested groups alongside leaf conditions", () => {
    const rule: IRule = {
      id: "complex",
      type: "permissive",
      conditions: [
        group("and", [cond("$.min", "lte", 10), cond("$.max", "gte", 20)]),
        group("or", [cond("$.flag", "eq", "a"), cond("$.flag", "eq", "b")]),
      ],
    };
    const r = createRule(rule);
    assert.equal(r.evaluate(createContext({ min: 5, max: 25, flag: "a" })), true);
    assert.equal(r.evaluate(createContext({ min: 5, max: 25, flag: "c" })), false);
    assert.equal(r.evaluate(createContext({ min: 15, max: 25, flag: "a" })), false);
  });
});

describe("RuleSet nesting and createEvaluable", () => {
  it("createEvaluable with IRule behaves like createRule", () => {
    const definition: IRule = {
      id: "r",
      type: "permissive",
      conditions: [cond("$.x", "eq", 1)],
    };
    assert.equal(
      createEvaluable(definition).evaluate(createContext({ x: 1 })),
      createRule(definition).evaluate(createContext({ x: 1 })),
    );
  });

  it("three-level RuleSet chain", () => {
    const leaf: IRule = {
      id: "leaf",
      type: "permissive",
      conditions: [cond("$.token", "eq", "ok")],
    };
    const mid: IRuleSet = { id: "mid", rules: [leaf] };
    const top: IRuleSet = { id: "top", rules: [mid] };
    const engine = createRuleSet(top);
    assert.equal(engine.evaluate(createContext({ token: "ok" })), true);
    assert.equal(engine.evaluate(createContext({ token: "bad" })), false);
  });

  it("sibling rules and nested RuleSet under one parent", () => {
    const set: IRuleSet = {
      id: "root",
      rules: [
        { id: "r1", type: "permissive", conditions: [cond("$.a", "eq", 1)] },
        {
          id: "subset",
          rules: [
            { id: "r2", type: "permissive", conditions: [cond("$.b", "eq", 2)] },
            { id: "r3", type: "permissive", conditions: [cond("$.c", "eq", 3)] },
          ],
        },
      ],
    };
    const engine = createRuleSet(set);
    assert.equal(engine.evaluate(createContext({ a: 1, b: 2, c: 3 })), true);
    assert.equal(engine.evaluate(createContext({ a: 1, b: 2, c: 9 })), false);
    assert.equal(engine.evaluate(createContext({ a: 9, b: 2, c: 3 })), false);
  });

  it("createEvaluable selects RuleSet branch for nested structure", () => {
    const inner: IRuleSet = {
      id: "inner",
      rules: [{ id: "r", type: "permissive", conditions: [cond("$.z", "eq", 7)] }],
    };
    assert.equal(createEvaluable(inner).evaluate(createContext({ z: 7 })), true);
  });
});

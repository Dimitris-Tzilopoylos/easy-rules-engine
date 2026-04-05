import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  conditionSchema,
  contextSchema,
  createCondition,
  createContext,
  createEvaluable,
  createOperatorRegistry,
  createRule,
  createRuleSet,
  evaluableSchema,
  parseCondition,
  parseEvaluable,
  ruleSchema,
  ruleSetSchema,
  safeParseCondition,
  safeParseRule,
} from "../src/index";
import { assertEvalParity, cond, group } from "./helpers";
import { deeplyNestedGroupsRuleJson } from "./fixtures/engineFixtures";
import type { IRule, IRuleSet } from "../src/lib/types";

function assertZodError(thunk: () => void): ZodError {
  try {
    thunk();
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof ZodError, `expected ZodError, got ${e}`);
    return e;
  }
}

describe("Zod schema parsing", () => {
  it("accepts a valid leaf condition", () => {
    const r = conditionSchema.safeParse(cond("$.a", "eq", 1));
    assert.equal(r.success, true);
  });

  it("accepts valuePath leaf", () => {
    const r = conditionSchema.safeParse({
      field: "$.a",
      operator: "eq",
      valuePath: "$.b",
    });
    assert.equal(r.success, true);
  });

  it("accepts value: undefined via explicit key (Object.hasOwn)", () => {
    const r = conditionSchema.safeParse({
      field: "a",
      operator: "eq",
      value: undefined,
    });
    assert.equal(r.success, true);
  });

  it("rejects leaf with both value and valuePath", () => {
    const r = safeParseCondition({
      field: "$.a",
      operator: "eq",
      value: 1,
      valuePath: "$.b",
    });
    assert.equal(r.success, false);
  });

  it("rejects leaf with neither value nor valuePath", () => {
    const r = safeParseCondition({ field: "$.a", operator: "eq" });
    assert.equal(r.success, false);
  });

  it("rejects reserved operator on leaf shape", () => {
    const r = safeParseCondition({
      field: "$.a",
      operator: "and",
      value: 1,
    });
    assert.equal(r.success, false);
  });

  it("accepts nested group", () => {
    const r = conditionSchema.safeParse(
      group("and", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
    );
    assert.equal(r.success, true);
  });

  it("accepts empty group conditions array", () => {
    const r = conditionSchema.safeParse({ operator: "and", conditions: [] });
    assert.equal(r.success, true);
  });

  it("parses rule and createEvaluable accepts output", () => {
    const rule: IRule = {
      id: "r",
      type: "permissive",
      conditions: [cond("$.x", "eq", 1)],
    };
    const parsed = ruleSchema.parse(rule);
    assert.equal(createEvaluable(parsed).evaluate(createContext({ x: 1 })), true);
  });

  it("parses rule set recursively", () => {
    const set: IRuleSet = {
      id: "s",
      rules: [
        {
          id: "inner",
          rules: [
            { id: "r", type: "permissive", conditions: [cond("$.z", "eq", 3)] },
          ],
        },
      ],
    };
    const parsed = ruleSetSchema.parse(set);
    assert.equal(createEvaluable(parsed).evaluate(createContext({ z: 3 })), true);
  });

  it("evaluableSchema accepts rule or rule set", () => {
    const rule: IRule = {
      id: 1,
      type: "permissive",
      conditions: [],
    };
    assert.equal(evaluableSchema.safeParse(rule).success, true);
    const set: IRuleSet = { id: 2, rules: [rule] };
    assert.equal(evaluableSchema.safeParse(set).success, true);
  });

  it("createEvaluable validates raw object same as parseEvaluable", () => {
    const raw = {
      id: "x",
      type: "permissive" as const,
      conditions: [{ field: "a", operator: "eq", value: 1 }],
    };
    const a = createEvaluable(raw);
    const b = createEvaluable(parseEvaluable(raw));
    assert.equal(a.evaluate(createContext({ a: 1 })), true);
    assert.equal(b.evaluate(createContext({ a: 1 })), true);
  });

  it("contextSchema requires input and allows extra keys", () => {
    const c = contextSchema.parse({ input: { a: 1 }, meta: "ok" });
    assert.equal(c.input.a, 1);
    assert.equal((c as { meta?: string }).meta, "ok");
  });

  it("rejects unknown keys on strict rule", () => {
    const r = ruleSchema.safeParse({
      id: "r",
      type: "permissive",
      conditions: [],
      extra: true,
    });
    assert.equal(r.success, false);
  });

  it("rejects rule missing id", () => {
    const r = safeParseRule({
      type: "permissive",
      conditions: [],
    });
    assert.equal(r.success, false);
  });

  it("accepts deeply nested condition groups in ruleSchema", () => {
    const raw = deeplyNestedGroupsRuleJson();
    const r = ruleSchema.safeParse(raw);
    assert.equal(r.success, true);
  });

  it("parseCondition + createCondition evaluates nested groups", async () => {
    const def = deeplyNestedGroupsRuleJson().conditions[0];
    const parsed = parseCondition(def);
    const c = createCondition(parsed);
    await assertEvalParity(
      c,
      createContext({ region: "eu", role: "user", tier: "gold" }),
      true,
    );
  });

  it("deep rule set nesting (4 levels)", () => {
    const deep = (n: number, inner: IRule): IRuleSet | IRule => {
      if (n <= 0) return inner;
      return { id: `L${n}`, rules: [deep(n - 1, inner) as IRule | IRuleSet] };
    };
    const inner: IRule = {
      id: "leaf",
      type: "permissive",
      conditions: [cond("$.k", "eq", true)],
    };
    const root = deep(4, inner) as IRuleSet;
    const parsed = ruleSetSchema.parse(root);
    assert.equal(
      createEvaluable(parsed).evaluate(createContext({ k: true })),
      true,
    );
  });
});

describe("Factories enforce Zod", () => {
  it("createRule throws ZodError on invalid payload", () => {
    const err = assertZodError(() =>
      createRule({ type: "permissive", conditions: [] }),
    );
    assert.ok(err.errors.some((e) => e.path.includes("id")));
  });

  it("createRuleSet evaluates after validation", () => {
    const e = createRuleSet({
      id: "s",
      rules: [
        {
          id: "r",
          type: "permissive",
          conditions: [{ field: "n", operator: "gte", value: 0 }],
        },
      ],
    });
    assert.equal(e.evaluate(createContext({ n: 5 })), true);
    assert.equal(e.evaluate(createContext({ n: -1 })), false);
  });

  it("createEvaluable dispatches rule vs rule set with single parse", () => {
    const ruleOnly = {
      id: "r",
      type: "permissive" as const,
      conditions: [{ field: "a", operator: "eq", value: 1 }],
    };
    assert.equal(createEvaluable(ruleOnly).evaluate(createContext({ a: 1 })), true);
    const asSet = { id: "s", rules: [ruleOnly] };
    assert.equal(createEvaluable(asSet).evaluate(createContext({ a: 1 })), true);
  });

  it("createCondition validates leaf and group", () => {
    const leaf = createCondition({
      field: "p",
      operator: "eq",
      value: "ok",
    });
    assert.equal(leaf.evaluate(createContext({ p: "ok" })), true);

    const grp = createCondition({
      operator: "or",
      conditions: [
        { field: "a", operator: "eq", value: 1 },
        { field: "b", operator: "eq", value: 2 },
      ],
    });
    assert.equal(grp.evaluate(createContext({ a: 0, b: 2 })), true);
  });

  it("createContext rejects non-object", () => {
    assertZodError(() => createContext(null));
    assertZodError(() => createContext("x"));
  });

  it("createContext accepts empty object as empty input shorthand", () => {
    assert.deepEqual(createContext({}).input, {});
  });

  it("createContext accepts plain input shorthand", () => {
    const ctx = createContext({ a: 1 });
    assert.equal(ctx.input.a, 1);
  });

  it("createContext accepts full context with extras", () => {
    const ctx = createContext({ input: { a: 1 }, traceId: "t1" });
    assert.equal(ctx.input.a, 1);
    assert.equal((ctx as { traceId?: string }).traceId, "t1");
  });

  it("createRule forwards EngineOptions (custom operators)", () => {
    const operators = createOperatorRegistry({
      isTwo: ({ fieldValue }) => fieldValue === 2,
    });
    const e = createRule(
      {
        id: "r",
        type: "permissive",
        conditions: [{ field: "n", operator: "isTwo", value: 0 }],
      },
      { operators },
    );
    assert.equal(e.evaluate(createContext({ n: 2 })), true);
    assert.equal(e.evaluate(createContext({ n: 3 })), false);
  });

  it("createEvaluable + evaluateAsync with async operator", async () => {
    const operators = createOperatorRegistry({
      delayEq: ({ fieldValue, value }) =>
        Promise.resolve(fieldValue === value),
    });
    const e = createEvaluable(
      {
        id: "r",
        type: "permissive",
        conditions: [{ field: "a", operator: "delayEq", value: 1 }],
      },
      { operators },
    );
    assert.equal(await e.evaluateAsync(createContext({ a: 1 })), true);
  });
});

describe("Schema edge cases (id & strict shapes)", () => {
  it("accepts id: null on rule (key must exist)", () => {
    const r = safeParseRule({
      id: null,
      type: "permissive",
      conditions: [],
    });
    assert.equal(r.success, true);
  });

  it("rejects condition group with unknown key (strict)", () => {
    const r = safeParseCondition({
      operator: "and",
      conditions: [],
      typo: 1,
    } as unknown as Record<string, unknown>);
    assert.equal(r.success, false);
  });

  it("not group: true when no child is true", () => {
    const c = createCondition(
      group("not", [cond("$.a", "eq", 1), cond("$.b", "eq", 2)]),
    );
    assert.equal(c.evaluate(createContext({ a: 0, b: 0 })), true);
    assert.equal(c.evaluate(createContext({ a: 1, b: 0 })), false);
  });

  it("createRule evaluateAsync matches evaluate for permissive", async () => {
    const e = createRule({
      id: "r",
      type: "permissive",
      conditions: [cond("$.x", "eq", 1)],
    });
    const ctx = createContext({ x: 1 });
    assert.equal(e.evaluate(ctx), await e.evaluateAsync(ctx));
  });
});

describe("Schema vs evaluation boundary", () => {
  it("unknown operator passes Zod; evaluate throws at operator lookup", () => {
    const e = createRule({
      id: "x",
      type: "permissive",
      conditions: [{ field: "a", operator: "notARealOperator", value: 1 }],
    });
    assert.throws(
      () => e.evaluate(createContext({ a: 1 })),
      /Unknown condition operator/,
    );
  });

  it("shape invalid for engine is rejected by Zod in createCondition", () => {
    assertZodError(() => createCondition({ field: "a", operator: "eq" }));
  });

  it("restrictive all-pass still throws at evaluate (not Zod)", () => {
    const e = createRule({
      id: "r",
      type: "restrictive",
      conditions: [{ field: "a", operator: "eq", value: 1 }],
    });
    assert.throws(
      () => e.evaluate(createContext({ a: 1 })),
      /Invalid rule type/,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createContext,
  createEvaluable,
  createRule,
  createRuleSet,
} from "../src/lib/factory";
import { cond } from "./helpers";
import type { IRule, IRuleSet } from "../src/lib/types";

describe("Rule permissive", () => {
  it("is true when every condition passes", () => {
    const rule: IRule = {
      id: "r1",
      type: "permissive",
      conditions: [cond("$.a", "eq", 1), cond("$.b", "eq", 2)],
    };
    assert.equal(createRule(rule).evaluate(createContext({ a: 1, b: 2 })), true);
    assert.equal(createRule(rule).evaluate(createContext({ a: 1, b: 0 })), false);
  });
});

describe("Rule restrictive", () => {
  it("is true when at least one condition fails", () => {
    const rule: IRule = {
      id: "r2",
      type: "restrictive",
      conditions: [cond("$.a", "eq", 1)],
    };
    assert.equal(createRule(rule).evaluate(createContext({ a: 2 })), true);
  });

  it("throws when every condition passes (current engine behavior)", () => {
    const rule: IRule = {
      id: "r3",
      type: "restrictive",
      conditions: [cond("$.a", "eq", 1)],
    };
    assert.throws(
      () => createRule(rule).evaluate(createContext({ a: 1 })),
      /Invalid rule type/,
    );
  });
});

describe("RuleSet", () => {
  it("requires every nested rule to pass", () => {
    const set: IRuleSet = {
      id: "s1",
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
    };
    assert.equal(createRuleSet(set).evaluate(createContext({ x: 1, y: 2 })), true);
    assert.equal(createRuleSet(set).evaluate(createContext({ x: 1, y: 0 })), false);
  });

  it("createEvaluable nests RuleSet", () => {
    const inner: IRuleSet = {
      id: "inner",
      rules: [{ id: "r", type: "permissive", conditions: [cond("$.z", "eq", 3)] }],
    };
    const set: IRuleSet = { id: "outer", rules: [inner] };
    assert.equal(createEvaluable(set).evaluate(createContext({ z: 3 })), true);
  });
});

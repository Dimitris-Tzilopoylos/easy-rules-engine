import assert from "node:assert/strict";
import type {
  Evaluatable,
  IBaseCondition,
  IBaseConditionGroup,
  IContext,
} from "../src/lib/types";

export async function assertEvalParity(
  e: Evaluatable,
  ctx: IContext,
  expected: boolean,
): Promise<void> {
  assert.equal(e.evaluate(ctx), expected, "evaluate");
  assert.equal(await e.evaluateAsync(ctx), expected, "evaluateAsync");
}

export function cond(
  field: string,
  operator: IBaseCondition["operator"],
  value: unknown,
): IBaseCondition {
  return { field, operator, value };
}

export function condValuePath(
  field: string,
  operator: IBaseCondition["operator"],
  valuePath: string,
): IBaseCondition {
  return { field, operator, valuePath };
}

export function group(
  operator: IBaseConditionGroup["operator"],
  conditions: (IBaseCondition | IBaseConditionGroup)[],
): IBaseConditionGroup {
  return { operator, conditions };
}

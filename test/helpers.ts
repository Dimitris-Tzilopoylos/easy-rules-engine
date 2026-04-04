import type { IBaseCondition, IBaseConditionGroup } from "../src/lib/types";

export function cond(
  field: string,
  operator: IBaseCondition["operator"],
  value?: unknown,
): IBaseCondition {
  return { field, operator, value };
}

export function group(
  operator: IBaseConditionGroup["operator"],
  conditions: (IBaseCondition | IBaseConditionGroup)[],
): IBaseConditionGroup {
  return { operator, conditions };
}

import type { IRule, IRuleSet } from "../../src/lib/types";

export function minimalPermissiveRule(id: string | number = "rule"): IRule {
  return { id, type: "permissive", conditions: [] };
}

export function minimalRuleSet(id: string = "set"): IRuleSet {
  return { id, rules: [minimalPermissiveRule(`${id}-child`)] };
}

export function apiStyleRuleJson() {
  return {
    id: "api-1",
    type: "permissive" as const,
    conditions: [
      { field: "status", operator: "eq" as const, value: "active" },
      {
        operator: "and" as const,
        conditions: [
          { field: "score", operator: "gte" as const, value: 10 },
          { field: "role", operator: "neq" as const, value: "guest" },
        ],
      },
    ],
  };
}

export function deeplyNestedGroupsRuleJson() {
  return {
    id: "nested-policy",
    type: "permissive" as const,
    conditions: [
      {
        operator: "and" as const,
        conditions: [
          { field: "region", operator: "eq" as const, value: "eu" },
          {
            operator: "or" as const,
            conditions: [
              {
                operator: "and" as const,
                conditions: [
                  { field: "role", operator: "eq" as const, value: "admin" },
                  { field: "tier", operator: "eq" as const, value: "gold" },
                ],
              },
              {
                operator: "and" as const,
                conditions: [
                  { field: "role", operator: "eq" as const, value: "user" },
                  { field: "tier", operator: "eq" as const, value: "gold" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

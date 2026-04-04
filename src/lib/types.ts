export type KnownConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "ncontains"
  | "all"
  | "any"
  | "nany"
  | "none";

export type ConditionOperator = KnownConditionOperator | (string & {});

export interface IBaseConditionCore {
  field: string;
  operator: ConditionOperator;
}

export type IBaseCondition =
  | (IBaseConditionCore & { value: unknown; valuePath: never })
  | (IBaseConditionCore & { valuePath: string; value: never });

export interface IBaseConditionGroup {
  conditions: (IBaseCondition | IBaseConditionGroup)[];
  operator: "and" | "or" | "not";
}

export type RuleType = "permissive" | "restrictive";

export interface IRule {
  id: any;
  conditions: (IBaseCondition | IBaseConditionGroup)[];
  type: RuleType;
}

export interface IRuleSet {
  id: any;
  rules: (IRule | IRuleSet)[];
}

export interface IContext {
  input: Record<string, any>;
  [key: string]: any;
}

export interface Evaluatable {
  evaluate(context: IContext): boolean;
}

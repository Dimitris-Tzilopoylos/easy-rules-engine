import { ConditionFactory, type PathParseCache } from "./condition";
import type { ParsedQuery } from "./jspath";
import { resolveOperators, type EngineOptions } from "./operators";
import { Rule, RuleSet } from "./rule";
import type {
  Evaluatable,
  IBaseCondition,
  IBaseConditionGroup,
  IContext,
  IRule,
  IRuleSet,
} from "./types";

export const createRule = (rule: IRule, options?: EngineOptions): Evaluatable => {
  return new Rule(rule, options);
};

export const createRuleSet = (
  ruleSet: IRuleSet,
  options?: EngineOptions,
): Evaluatable => {
  return new RuleSet(ruleSet, options);
};

export const createEvaluable = (
  definition: IRule | IRuleSet,
  options?: EngineOptions,
): Evaluatable => {
  if ("rules" in definition) {
    return createRuleSet(definition, options);
  }
  return createRule(definition, options);
};

export const createCondition = (
  definition: IBaseCondition | IBaseConditionGroup,
  options?: EngineOptions,
): Evaluatable => {
  const operators = resolveOperators(options?.operators);
  const pathParseCache: PathParseCache = new Map<string, ParsedQuery>();
  return ConditionFactory.create(definition, { operators, pathParseCache });
};

export const createContext = (input: Record<string, any>): IContext => {
  return { input };
};

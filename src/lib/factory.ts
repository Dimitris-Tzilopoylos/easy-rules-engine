import { ConditionFactory } from "./condition";
import type { EngineOptions } from "./operators";
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
  return ConditionFactory.create(definition, {
    operators: options?.operators,
  });
};

export const createContext = (input: Record<string, any>): IContext => {
  return { input };
};

import {
  parseCondition,
  parseCreateContextArgument,
  parseEvaluable,
  parseRule,
  parseRuleSet,
} from "../schemas";
import { ConditionFactory, type PathParseCache } from "./condition";
import type { ParsedQuery } from "./jspath";
import { resolveOperators, type EngineOptions } from "./operators";
import { Rule, RuleSet } from "./rule";
import type { Evaluatable, IContext } from "./types";

export const createRule = (data: unknown, options?: EngineOptions): Evaluatable => {
  return new Rule(parseRule(data), options);
};

export const createRuleSet = (
  data: unknown,
  options?: EngineOptions,
): Evaluatable => {
  return new RuleSet(parseRuleSet(data), options);
};

export const createEvaluable = (
  data: unknown,
  options?: EngineOptions,
): Evaluatable => {
  const definition = parseEvaluable(data);
  if ("rules" in definition) {
    return new RuleSet(definition, options);
  }
  return new Rule(definition, options);
};

export const createCondition = (
  data: unknown,
  options?: EngineOptions,
): Evaluatable => {
  const operators = resolveOperators(options?.operators);
  const pathParseCache: PathParseCache = new Map<string, ParsedQuery>();
  return ConditionFactory.create(parseCondition(data), {
    operators,
    pathParseCache,
  });
};

export const createContext = (data: unknown): IContext => {
  return parseCreateContextArgument(data);
};

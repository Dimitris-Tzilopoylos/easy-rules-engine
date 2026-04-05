export {
  createCondition,
  createContext,
  createEvaluable,
  createRule,
  createRuleSet,
} from "./lib/factory";

export {
  conditionSchema,
  contextSchema,
  createContextArgumentSchema,
  evaluableSchema,
  parseCondition,
  parseContext,
  parseCreateContextArgument,
  parseEvaluable,
  parseRule,
  parseRuleSet,
  ruleSchema,
  ruleSetSchema,
  safeParseCondition,
  safeParseContext,
  safeParseCreateContextArgument,
  safeParseEvaluable,
  safeParseRule,
  safeParseRuleSet,
} from "./schemas";

export type {
  ZodCondition,
  ZodContext,
  ZodEvaluable,
  ZodRule,
  ZodRuleSet,
} from "./schemas";

export {
  createDefaultOperatorRegistry,
  createOperatorRegistry,
  mergeWithDefaultOperators,
  OperatorRegistry,
  resolveOperators,
} from "./lib/operators";

export type {
  ConditionOperatorArgs,
  ConditionOperatorHandler,
  EngineOptions,
} from "./lib/operators";

export type {
  ConditionOperator,
  Evaluatable,
  IBaseCondition,
  IBaseConditionCore,
  IBaseConditionGroup,
  IContext,
  IRule,
  IRuleSet,
  KnownConditionOperator,
  RuleType,
} from "./lib/types";

export {
  evaluateParsed,
  first,
  firstParsed,
  last,
  lastParsed,
  parse,
  query,
  values,
} from "./lib/jspath";

export type {
  JsonArray,
  JsonObject,
  JsonValue,
  ParsedQuery,
  QueryResult,
  Selector,
} from "./lib/jspath";

export {
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  contains,
  ncontains,
  all,
  any,
  nany,
  none,
  isIn,
  nin,
  startsWith,
  endsWith,
  matches,
  between,
  defined,
  blank,
  notBlank,
  isOfType,
} from "./lib/defaultOperators";

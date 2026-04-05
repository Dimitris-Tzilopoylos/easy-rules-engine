import { z } from "zod";
import type {
  IBaseCondition,
  IBaseConditionGroup,
  IContext,
  IRule,
  IRuleSet,
} from "./lib/types";

const GROUP_OPERATORS = new Set<string>(["and", "or", "not"]);

const leafConditionSchema = z
  .object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown().optional(),
    valuePath: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (GROUP_OPERATORS.has(data.operator)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Operator "${data.operator}" is reserved for condition groups; use { operator: "and" | "or" | "not", conditions } instead.`,
      });
    }
    const hasValue = Object.hasOwn(data, "value");
    const hasValuePath = Object.hasOwn(data, "valuePath");
    if (hasValue === hasValuePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Invalid condition: provide exactly one of value or valuePath (same rules as the engine's ConditionFactory).",
      });
    }
  });

export const conditionSchema = z.lazy(() =>
  z.union([
    z
      .object({
        operator: z.enum(["and", "or", "not"]),
        conditions: z.array(conditionSchema),
      })
      .strict(),
    leafConditionSchema,
  ]),
) as z.ZodType<IBaseCondition | IBaseConditionGroup>;

function requireOwnKey(
  key: string,
  message = `Required`,
): (data: Record<string, unknown>, ctx: z.RefinementCtx) => void {
  return (data, ctx) => {
    if (!Object.hasOwn(data, key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [key],
      });
    }
  };
}

export const ruleSchema = z
  .object({
    id: z.unknown(),
    type: z.enum(["permissive", "restrictive"]),
    conditions: z.array(conditionSchema),
  })
  .strict()
  .superRefine(requireOwnKey("id")) as z.ZodType<IRule>;

export const ruleSetSchema = z.lazy(() =>
  z
    .object({
      id: z.unknown(),
      rules: z.array(evaluableSchema),
    })
    .strict()
    .superRefine(requireOwnKey("id")),
) as z.ZodType<IRuleSet>;

export const evaluableSchema = z.lazy(() =>
  z.union([ruleSchema, ruleSetSchema]),
) as z.ZodType<IRule | IRuleSet>;

export const contextSchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
  })
  .passthrough() as z.ZodType<IContext>;

const plainInputAsContext = z
  .record(z.string(), z.unknown())
  .transform((input): IContext => ({ input }));

export const createContextArgumentSchema = z.union([
  contextSchema,
  plainInputAsContext,
]) as z.ZodType<IContext>;

export type ZodCondition = z.infer<typeof conditionSchema>;
export type ZodRule = z.infer<typeof ruleSchema>;
export type ZodRuleSet = z.infer<typeof ruleSetSchema>;
export type ZodEvaluable = z.infer<typeof evaluableSchema>;
export type ZodContext = z.infer<typeof contextSchema>;

export function parseCondition(
  data: unknown,
): IBaseCondition | IBaseConditionGroup {
  return conditionSchema.parse(data);
}

export function safeParseCondition(data: unknown) {
  return conditionSchema.safeParse(data);
}

export function parseRule(data: unknown): IRule {
  return ruleSchema.parse(data);
}

export function safeParseRule(data: unknown) {
  return ruleSchema.safeParse(data);
}

export function parseRuleSet(data: unknown): IRuleSet {
  return ruleSetSchema.parse(data);
}

export function safeParseRuleSet(data: unknown) {
  return ruleSetSchema.safeParse(data);
}

export function parseEvaluable(data: unknown): IRule | IRuleSet {
  return evaluableSchema.parse(data);
}

export function safeParseEvaluable(data: unknown) {
  return evaluableSchema.safeParse(data);
}

export function parseContext(data: unknown): IContext {
  return contextSchema.parse(data);
}

export function safeParseContext(data: unknown) {
  return contextSchema.safeParse(data);
}

export function parseCreateContextArgument(data: unknown): IContext {
  return createContextArgumentSchema.parse(data);
}

export function safeParseCreateContextArgument(data: unknown) {
  return createContextArgumentSchema.safeParse(data);
}

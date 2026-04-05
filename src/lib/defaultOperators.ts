import type { ConditionOperator, IBaseCondition } from "./types";

const createBaseOperator = (operator: ConditionOperator) => (
  args: IBaseCondition & { field: string },
): IBaseCondition => {
  const { field, ...rest } = args;
  return {
    field,
    ...rest,
    operator,
  };
};

export const eq = createBaseOperator("eq");

export const neq = createBaseOperator("neq");

export const gt = createBaseOperator("gt");

export const gte = createBaseOperator("gte");

export const lt = createBaseOperator("lt");

export const lte = createBaseOperator("lte");

export const contains = createBaseOperator("contains");

export const ncontains = createBaseOperator("ncontains");

export const all = createBaseOperator("all");

export const any = createBaseOperator("any");

export const nany = createBaseOperator("nany");

export const none = createBaseOperator("none");

export const isIn = createBaseOperator("in");

export const nin = createBaseOperator("nin");

export const startsWith = createBaseOperator("startsWith");

export const endsWith = createBaseOperator("endsWith");

export const matches = createBaseOperator("matches");

export const between = createBaseOperator("between");

export const defined = createBaseOperator("defined");

export const blank = createBaseOperator("blank");

export const notBlank = createBaseOperator("notBlank");

export const isOfType = createBaseOperator("isOfType");

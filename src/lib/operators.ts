import type { IBaseCondition, IContext } from "./types";

export type ConditionOperatorArgs = {
  fieldValue: unknown;
  value: unknown;
  condition: IBaseCondition;
  context: IContext;
};

export type ConditionOperatorHandler = (args: ConditionOperatorArgs) => boolean;

const GROUP_OPERATORS = new Set(["and", "or", "not"]);

function relationalPair(a: unknown, b: unknown): [string | number, string | number] {
  return [a as string | number, b as string | number];
}

export class OperatorRegistry {
  private readonly handlers = new Map<string, ConditionOperatorHandler>();

  private copyHandlersFrom(source: OperatorRegistry): void {
    for (const [name, handler] of source.handlers) {
      this.handlers.set(name, handler);
    }
  }

  static merge(base: OperatorRegistry, overlay: OperatorRegistry): OperatorRegistry {
    const next = new OperatorRegistry();
    next.copyHandlersFrom(base);
    next.copyHandlersFrom(overlay);
    return next;
  }

  register(name: string, handler: ConditionOperatorHandler): this {
    if (GROUP_OPERATORS.has(name)) {
      throw new Error(`Operator name "${name}" is reserved for condition groups`);
    }
    this.handlers.set(name, handler);
    return this;
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  evaluate(operator: string, args: ConditionOperatorArgs): boolean {
    const handler = this.handlers.get(operator);
    if (!handler) {
      throw new Error(`Unknown condition operator: ${operator}`);
    }
    return handler(args);
  }
}

export function createOperatorRegistry(
  handlers: Record<string, ConditionOperatorHandler>,
): OperatorRegistry {
  const r = new OperatorRegistry();
  for (const [name, handler] of Object.entries(handlers)) {
    r.register(name, handler);
  }
  return r;
}

const DEFAULT_CONDITION_OPERATORS: Record<string, ConditionOperatorHandler> = {
  eq: ({ fieldValue, value }) => fieldValue === value,
  neq: ({ fieldValue, value }) => fieldValue !== value,
  gt: ({ fieldValue, value }) => {
    const [a, b] = relationalPair(fieldValue, value);
    return a > b;
  },
  gte: ({ fieldValue, value }) => {
    const [a, b] = relationalPair(fieldValue, value);
    return a >= b;
  },
  lt: ({ fieldValue, value }) => {
    const [a, b] = relationalPair(fieldValue, value);
    return a < b;
  },
  lte: ({ fieldValue, value }) => {
    const [a, b] = relationalPair(fieldValue, value);
    return a <= b;
  },
  contains: ({ fieldValue, value }) =>
    (value as { includes: (v: unknown) => boolean }).includes(fieldValue),
  ncontains: ({ fieldValue, value }) =>
    !(fieldValue as { includes: (v: unknown) => boolean }).includes(value),
  all: ({ fieldValue, value }) =>
    (value as unknown[]).every((item: unknown) => item === fieldValue),
  any: ({ fieldValue, value }) =>
    (value as unknown[]).some((item: unknown) => item === fieldValue),
  nany: ({ fieldValue, value }) =>
    !(value as unknown[]).some((item: unknown) => item === fieldValue),
  none: ({ fieldValue, value }) =>
    !(value as unknown[]).some((item: unknown) => item === fieldValue),
};

export function createDefaultOperatorRegistry(): OperatorRegistry {
  return createOperatorRegistry(DEFAULT_CONDITION_OPERATORS);
}

export function mergeWithDefaultOperators(
  custom: OperatorRegistry,
): OperatorRegistry {
  return OperatorRegistry.merge(createDefaultOperatorRegistry(), custom);
}

export function resolveOperators(
  custom?: OperatorRegistry,
): OperatorRegistry {
  return custom != null
    ? mergeWithDefaultOperators(custom)
    : createDefaultOperatorRegistry();
}

export type EngineOptions = {
  operators?: OperatorRegistry;
};

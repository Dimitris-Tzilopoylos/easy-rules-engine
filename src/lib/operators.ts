import type { IBaseCondition, IContext } from "./types";

export type ConditionOperatorArgs = {
  fieldValue: unknown;
  value: unknown;
  condition: IBaseCondition;
  context: IContext;
};

export type ConditionOperatorHandler = (
  args: ConditionOperatorArgs,
) => boolean | Promise<boolean>;

function isThenable(x: unknown): x is Promise<boolean> {
  return (
    x != null &&
    typeof (x as { then?: unknown }).then === "function"
  );
}

const GROUP_OPERATORS = new Set(["and", "or", "not"]);

function relationalPair(
  a: unknown,
  b: unknown,
): [string | number, string | number] {
  return [a as string | number, b as string | number];
}

function isBlankField(v: unknown): boolean {
  if (v == null) {
    return true;
  }
  if (typeof v === "string") {
    return v.trim() === "";
  }
  if (Array.isArray(v)) {
    return v.length === 0;
  }
  if (typeof v === "object") {
    return Object.keys(v as object).length === 0;
  }
  return false;
}

function asCandidateList(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (value instanceof Set) {
    return [...value];
  }
  if (value instanceof Map) {
    return [...value.values()];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object" && Symbol.iterator in value) {
    try {
      return [...(value as Iterable<unknown>)];
    } catch {
      return [value];
    }
  }
  return [value];
}

function containsCollection(fieldValue: unknown, value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(String(fieldValue));
  }
  return asCandidateList(value).includes(fieldValue);
}

function ncontainsSubstring(fieldValue: unknown, value: unknown): boolean {
  const haystack = fieldValue == null ? "" : String(fieldValue);
  return !haystack.includes(String(value));
}

export class OperatorRegistry {
  private readonly handlers = new Map<string, ConditionOperatorHandler>();

  private copyHandlersFrom(source: OperatorRegistry): void {
    for (const [name, handler] of source.handlers) {
      this.handlers.set(name, handler);
    }
  }

  static merge(
    base: OperatorRegistry,
    overlay: OperatorRegistry,
  ): OperatorRegistry {
    const next = new OperatorRegistry();
    next.copyHandlersFrom(base);
    next.copyHandlersFrom(overlay);
    return next;
  }

  register(name: string, handler: ConditionOperatorHandler): this {
    if (GROUP_OPERATORS.has(name)) {
      throw new Error(
        `Operator name "${name}" is reserved for condition groups`,
      );
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
    const result = handler(args);
    if (isThenable(result)) {
      throw new Error(
        `Operator "${operator}" is async; use evaluateAsync(...) instead of evaluate(...)`,
      );
    }
    return result;
  }

  async evaluateAsync(
    operator: string,
    args: ConditionOperatorArgs,
  ): Promise<boolean> {
    const handler = this.handlers.get(operator);
    if (!handler) {
      throw new Error(`Unknown condition operator: ${operator}`);
    }
    return Promise.resolve(handler(args));
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
  contains: ({ fieldValue, value }) => containsCollection(fieldValue, value),
  ncontains: ({ fieldValue, value }) => ncontainsSubstring(fieldValue, value),
  all: ({ fieldValue, value }) =>
    asCandidateList(value).every((item: unknown) => item === fieldValue),
  any: ({ fieldValue, value }) =>
    asCandidateList(value).some((item: unknown) => item === fieldValue),
  nany: ({ fieldValue, value }) =>
    !asCandidateList(value).some((item: unknown) => item === fieldValue),
  none: ({ fieldValue, value }) =>
    !asCandidateList(value).some((item: unknown) => item === fieldValue),
  in: ({ fieldValue, value }) => asCandidateList(value).includes(fieldValue),
  nin: ({ fieldValue, value }) => !asCandidateList(value).includes(fieldValue),
  startsWith: ({ fieldValue, value }) =>
    typeof fieldValue === "string" &&
    typeof value === "string" &&
    fieldValue.startsWith(value),
  endsWith: ({ fieldValue, value }) =>
    typeof fieldValue === "string" &&
    typeof value === "string" &&
    fieldValue.endsWith(value),
  matches: ({ fieldValue, value }) => {
    if (typeof value !== "string") {
      return false;
    }
    try {
      return new RegExp(value).test(String(fieldValue));
    } catch {
      return false;
    }
  },
  between: ({ fieldValue, value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      return false;
    }
    const n = Number(fieldValue);
    if (Number.isNaN(n)) {
      return false;
    }
    const lo = Number(value[0]);
    const hi = Number(value[1]);
    if (Number.isNaN(lo) || Number.isNaN(hi)) {
      return false;
    }
    return n >= lo && n <= hi;
  },
  defined: ({ fieldValue }) => fieldValue !== undefined && fieldValue !== null,
  blank: ({ fieldValue }) => isBlankField(fieldValue),
  notBlank: ({ fieldValue }) => !isBlankField(fieldValue),
  isOfType: ({ fieldValue, value }) =>
    typeof value === "string" && typeof fieldValue === value,
};

export function createDefaultOperatorRegistry(): OperatorRegistry {
  return createOperatorRegistry(DEFAULT_CONDITION_OPERATORS);
}

export function mergeWithDefaultOperators(
  custom: OperatorRegistry,
): OperatorRegistry {
  return OperatorRegistry.merge(createDefaultOperatorRegistry(), custom);
}

export function resolveOperators(custom?: OperatorRegistry): OperatorRegistry {
  return custom != null
    ? mergeWithDefaultOperators(custom)
    : createDefaultOperatorRegistry();
}

export type EngineOptions = {
  operators?: OperatorRegistry;
};

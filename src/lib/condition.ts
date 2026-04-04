import { firstParsed, parse, type ParsedQuery } from "./jspath";
import { type OperatorRegistry } from "./operators";
import {
  type IBaseCondition,
  type IBaseConditionGroup,
  type IContext,
} from "./types";

export type PathParseCache = Map<string, ParsedQuery>;

export type ConditionBuildOptions = {
  operators: OperatorRegistry;
  pathParseCache: PathParseCache;
};

function primePathParseCache(path: string, cache: PathParseCache): void {
  if (!cache.has(path)) {
    cache.set(path, parse(path));
  }
}

function shouldPrewriteParse(path: string): boolean {
  return path.startsWith("$");
}

function readFromInput(
  input: Record<string, any>,
  keyOrPath: string,
  pathParseCache: PathParseCache,
): unknown {
  if (keyOrPath in input) {
    return input[keyOrPath];
  }
  let parsed = pathParseCache.get(keyOrPath);
  if (parsed === undefined) {
    parsed = parse(keyOrPath);
    pathParseCache.set(keyOrPath, parsed);
  }
  return firstParsed(input, parsed);
}

export class Condition {
  private readonly condition: IBaseCondition;
  private readonly operators: OperatorRegistry;
  private readonly pathParseCache: PathParseCache;

  constructor(condition: IBaseCondition, build: ConditionBuildOptions) {
    this.condition = condition;
    this.operators = build.operators;
    this.pathParseCache = build.pathParseCache;
    if (shouldPrewriteParse(condition.field)) {
      primePathParseCache(condition.field, this.pathParseCache);
    }
    if (Object.hasOwn(condition, "valuePath")) {
      const vp = (condition as Extract<IBaseCondition, { valuePath: string }>)
        .valuePath;
      if (shouldPrewriteParse(vp)) {
        primePathParseCache(vp, this.pathParseCache);
      }
    }
  }

  public evaluate(context: IContext): boolean {
    const fieldValue = readFromInput(
      context.input,
      this.condition.field,
      this.pathParseCache,
    );
    const c = this.condition;
    const value: unknown = Object.hasOwn(c, "valuePath")
      ? readFromInput(
          context.input,
          (c as Extract<IBaseCondition, { valuePath: string }>).valuePath,
          this.pathParseCache,
        )
      : (c as Extract<IBaseCondition, { value: unknown }>).value;
    return this.operators.evaluate(this.condition.operator as string, {
      fieldValue,
      value,
      condition: this.condition,
      context,
    });
  }
}

export class ConditionGroup {
  private readonly condition: IBaseConditionGroup;
  private _conditions: (Condition | ConditionGroup)[];

  constructor(
    condition: IBaseConditionGroup,
    build: ConditionBuildOptions,
  ) {
    this.condition = condition;
    this._conditions = this.condition.conditions.map((c) =>
      ConditionFactory.create(c, build),
    );
  }

  public evaluate(context: IContext): boolean {
    return this.evaluateCondition(context);
  }

  private evaluateCondition(context: IContext): boolean {
    if (this.condition.operator === "and") {
      return this._conditions.every((condition) => condition.evaluate(context));
    }
    if (this.condition.operator === "or") {
      return this._conditions.some((condition) => condition.evaluate(context));
    }
    if (this.condition.operator === "not") {
      return !this._conditions.some((condition) => condition.evaluate(context));
    }
    throw new Error("Invalid condition");
  }
}

function isLeafConditionShape(
  c: IBaseCondition | IBaseConditionGroup,
): c is IBaseCondition {
  const hasValue = Object.hasOwn(c, "value");
  const hasValuePath = Object.hasOwn(c, "valuePath");
  return hasValue !== hasValuePath;
}

export class ConditionFactory {
  static create(
    condition: IBaseCondition | IBaseConditionGroup,
    build: ConditionBuildOptions,
  ): Condition | ConditionGroup {
    if (
      condition.operator === "and" ||
      condition.operator === "or" ||
      condition.operator === "not"
    ) {
      return new ConditionGroup(condition as IBaseConditionGroup, build);
    }
    if (isLeafConditionShape(condition)) {
      return new Condition(condition, build);
    }
    throw new Error(
      "Invalid condition: provide exactly one of value or valuePath",
    );
  }
}

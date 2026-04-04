import { first } from "./jspath";
import { resolveOperators, type OperatorRegistry } from "./operators";
import {
  type IBaseCondition,
  type IBaseConditionGroup,
  type IContext,
} from "./types";

function readFromInput(input: Record<string, any>, keyOrPath: string): unknown {
  if (keyOrPath in input) {
    return input[keyOrPath];
  }
  return first(input, keyOrPath);
}

export class Condition {
  private readonly condition: IBaseCondition;
  private readonly operators: OperatorRegistry;

  constructor(condition: IBaseCondition, customOperators?: OperatorRegistry) {
    this.condition = condition;
    this.operators = resolveOperators(customOperators);
  }

  public evaluate(context: IContext): boolean {
    const fieldValue = readFromInput(context.input, this.condition.field);
    const c = this.condition;
    const value: unknown = Object.hasOwn(c, "valuePath")
      ? readFromInput(
          context.input,
          (c as Extract<IBaseCondition, { valuePath: string }>).valuePath,
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
  private readonly operators: OperatorRegistry;
  private _conditions: (Condition | ConditionGroup)[];

  constructor(
    condition: IBaseConditionGroup,
    customOperators?: OperatorRegistry,
  ) {
    this.condition = condition;
    this.operators = resolveOperators(customOperators);
    this._conditions = this.condition.conditions.map((c) =>
      ConditionFactory.create(c, { operators: this.operators }),
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
    options?: { operators?: OperatorRegistry },
  ): Condition | ConditionGroup {
    const operators = resolveOperators(options?.operators);
    if (
      condition.operator === "and" ||
      condition.operator === "or" ||
      condition.operator === "not"
    ) {
      return new ConditionGroup(condition as IBaseConditionGroup, operators);
    }
    if (isLeafConditionShape(condition)) {
      return new Condition(condition, operators);
    }
    throw new Error(
      "Invalid condition: provide exactly one of value or valuePath",
    );
  }
}

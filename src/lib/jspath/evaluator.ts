import {
  type JsonValue,
  type JsonObject,
  type JsonArray,
  type Selector,
  type QueryResult,
  type ParsedQuery,
  type FilterExpression,
} from "./types";

export class Evaluator {
  private document: JsonValue;
  private results: QueryResult[] = [];

  constructor(document: JsonValue) {
    this.document = document;
  }

  evaluate(query: ParsedQuery): QueryResult[] {
    this.results = [];
    let nodes: Node[] = [{ value: this.document, path: "$" }];

    for (const selector of query.selectors) {
      if (selector.type === "root") {
        continue;
      }

      const nextNodes: Node[] = [];
      for (const node of nodes) {
        const selected = this.applySelector(node, selector);
        nextNodes.push(...selected);
      }
      nodes = nextNodes;
    }

    for (const node of nodes) {
      this.results.push({ path: node.path, value: node.value });
    }

    return this.results;
  }

  private applySelector(node: Node, selector: Selector): Node[] {
    const value = node.value;

    switch (selector.type) {
      case "name":
        return this.selectName(node, selector.name);
      case "index":
        return this.selectIndex(node, selector.index);
      case "wildcard":
        return this.selectWildcard(node);
      case "slice":
        return this.selectSlice(
          node,
          selector.start,
          selector.end,
          selector.step
        );
      case "filter":
        return this.selectFilter(node, selector.expression);
      case "descendant":
        return this.selectDescendant(node, selector.selector);
      case "union":
        return this.selectUnion(node, selector.selectors);
      default:
        return [];
    }
  }

  private selectUnion(node: Node, selectors: Selector[]): Node[] {
    const results: Node[] = [];
    for (const selector of selectors) {
      results.push(...this.applySelector(node, selector));
    }
    return results;
  }

  private selectName(node: Node, name: string): Node[] {
    const value = node.value;
    if (this.isObject(value)) {
      if (name in value) {
        return [{ value: value[name], path: `${node.path}.${name}` }];
      }
    }
    return [];
  }

  private selectIndex(node: Node, index: number): Node[] {
    const value = node.value;
    if (this.isArray(value)) {
      const normalizedIndex = index < 0 ? value.length + index : index;
      if (normalizedIndex >= 0 && normalizedIndex < value.length) {
        return [
          {
            value: value[normalizedIndex],
            path: `${node.path}[${normalizedIndex}]`,
          },
        ];
      }
    }
    return [];
  }

  private selectWildcard(node: Node): Node[] {
    const value = node.value;
    const results: Node[] = [];

    if (this.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        results.push({ value: value[i], path: `${node.path}[${i}]` });
      }
    } else if (this.isObject(value)) {
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          results.push({ value: value[key], path: `${node.path}.${key}` });
        }
      }
    }

    return results;
  }

  private selectSlice(
    node: Node,
    start?: number,
    end?: number,
    step?: number
  ): Node[] {
    const value = node.value;
    if (!this.isArray(value)) {
      return [];
    }

    const arrayLength = value.length;
    const stepValue = step ?? 1;
    const startValue = start ?? (stepValue >= 0 ? 0 : arrayLength - 1);
    const endValue = end ?? (stepValue >= 0 ? arrayLength : -1);

    const results: Node[] = [];
    if (stepValue > 0) {
      const actualStart =
        startValue < 0
          ? Math.max(0, arrayLength + startValue)
          : Math.min(arrayLength, startValue);
      const actualEnd =
        endValue < 0
          ? Math.max(0, arrayLength + endValue)
          : Math.min(arrayLength, endValue);
      for (let i = actualStart; i < actualEnd; i += stepValue) {
        results.push({ value: value[i], path: `${node.path}[${i}]` });
      }
    } else if (stepValue < 0) {
      const actualStart =
        start !== undefined
          ? startValue < 0
            ? arrayLength + startValue
            : Math.min(arrayLength - 1, startValue)
          : arrayLength - 1;
      const actualEnd =
        end !== undefined
          ? endValue < 0
            ? arrayLength + endValue
            : endValue
          : -1;
      for (let i = actualStart; i > actualEnd; i += stepValue) {
        results.push({ value: value[i], path: `${node.path}[${i}]` });
      }
    }

    return results;
  }

  private selectFilter(node: Node, expression: FilterExpression): Node[] {
    const value = node.value;
    if (!this.isArray(value)) {
      return [];
    }

    const results: Node[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const contextNode: Node = { value: item, path: `${node.path}[${i}]` };
      if (this.evaluateFilter(contextNode, expression)) {
        results.push(contextNode);
      }
    }
    return results;
  }

  private selectDescendant(node: Node, selector: Selector): Node[] {
    const results: Node[] = [];
    this.collectDescendants(node, selector, results);
    return results;
  }

  private collectDescendants(
    node: Node,
    selector: Selector,
    results: Node[]
  ): void {
    const value = node.value;

    const matched = this.applySelector(node, selector);
    results.push(...matched);

    if (this.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const childNode: Node = { value: value[i], path: `${node.path}[${i}]` };
        this.collectDescendants(childNode, selector, results);
      }
    } else if (this.isObject(value)) {
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const childNode: Node = {
            value: value[key],
            path: `${node.path}.${key}`,
          };
          this.collectDescendants(childNode, selector, results);
        }
      }
    }
  }

  private evaluateFilter(node: Node, expression: FilterExpression): boolean {
    switch (expression.type) {
      case "comparison":
        return this.evaluateComparison(node, expression);
      case "logical":
        return this.evaluateLogical(node, expression);
      case "path":
        return this.evaluatePath(node, expression.path);
      case "existence":
        return this.evaluateExistence(node, expression.path);
      case "literal":
        return expression.value !== null && expression.value !== undefined;
      case "function":
        return this.evaluateFunction(node, expression);
      default:
        return false;
    }
  }

  private evaluateComparison(
    node: Node,
    expression: FilterExpression & { type: "comparison" }
  ): boolean {
    if (expression.operator === "in") {
      const left = this.getFilterValue(node, expression.left);
      const right = this.getFilterValue(node, expression.right);

      if (left === undefined || right === undefined) {
        return false;
      }

      if (this.isArray(right)) {
        return right.some((item) => {
          if (left !== undefined && item !== undefined) {
            return this.compareValues(left, item) === 0;
          }
          return false;
        });
      }
      return false;
    }

    const left = this.getFilterValue(node, expression.left);
    const right = this.getFilterValue(node, expression.right);

    if (left === undefined || right === undefined) {
      return false;
    }

    switch (expression.operator) {
      case "==":
        return this.compareValues(left, right) === 0;
      case "!=":
        return this.compareValues(left, right) !== 0;
      case "<":
        return this.compareValues(left, right) < 0;
      case "<=":
        return this.compareValues(left, right) <= 0;
      case ">":
        return this.compareValues(left, right) > 0;
      case ">=":
        return this.compareValues(left, right) >= 0;
      default:
        return false;
    }
  }

  private evaluateLogical(
    node: Node,
    expression: FilterExpression & { type: "logical" }
  ): boolean {
    const left = this.evaluateFilter(node, expression.left);
    if (expression.operator === "&&") {
      if (!left) return false;
      return this.evaluateFilter(node, expression.right);
    } else {
      if (left) return true;
      return this.evaluateFilter(node, expression.right);
    }
  }

  private evaluatePath(node: Node, path: ParsedQuery): boolean {
    const results = this.evaluatePathQuery(node, path);
    return results.some((r) => r.value !== undefined && r.value !== null);
  }

  private evaluateExistence(node: Node, path: ParsedQuery): boolean {
    const results = this.evaluatePathQuery(node, path);
    return results.length > 0 && results.some((r) => r.value !== undefined);
  }

  private evaluatePathQuery(node: Node, query: ParsedQuery): QueryResult[] {
    let nodes: Node[] = [node];

    for (let i = 1; i < query.selectors.length; i++) {
      const selector = query.selectors[i];
      const nextNodes: Node[] = [];
      for (const n of nodes) {
        nextNodes.push(...this.applySelector(n, selector));
      }
      nodes = nextNodes;
    }

    return nodes.map((n) => ({ path: n.path, value: n.value }));
  }

  private getFilterValue(
    node: Node,
    expression: FilterExpression
  ): JsonValue | undefined {
    if (expression.type === "path") {
      const results = this.evaluatePathQuery(node, expression.path);
      return results.length > 0 ? results[0].value : undefined;
    } else if (expression.type === "literal") {
      return expression.value;
    } else if (expression.type === "function") {
      return this.evaluateFunctionValue(node, expression);
    }
    return undefined;
  }

  private evaluateFunction(
    node: Node,
    expression: FilterExpression & { type: "function" }
  ): boolean {
    const result = this.evaluateFunctionValue(node, expression);
    return result !== undefined && result !== null;
  }

  private evaluateFunctionValue(
    node: Node,
    expression: FilterExpression & { type: "function" }
  ): JsonValue | undefined {
    const getArgumentValue = (arg: FilterExpression): JsonValue | undefined => {
      if (arg.type === "path") {
        const results = this.evaluatePathQuery(node, arg.path);
        return results.length > 0 ? results[0].value : undefined;
      } else if (arg.type === "literal") {
        return arg.value;
      } else if (arg.type === "function") {
        return this.evaluateFunctionValue(node, arg);
      }
      return undefined;
    };

    const getArgumentValues = (arg: FilterExpression): JsonValue[] => {
      if (arg.type === "path") {
        const results = this.evaluatePathQuery(node, arg.path);
        return results
          .map((r) => r.value)
          .filter((v) => v !== undefined && v !== null);
      }
      return [];
    };

    switch (expression.name) {
      case "sum": {
        const values = getArgumentValues(expression.argument);
        const numbers = values.filter((v) => typeof v === "number") as number[];
        if (numbers.length === 0) return undefined;
        return numbers.reduce((sum, n) => sum + n, 0);
      }
      case "avg": {
        const values = getArgumentValues(expression.argument);
        const numbers = values.filter((v) => typeof v === "number") as number[];
        if (numbers.length === 0) return undefined;
        const sum = numbers.reduce((sum, n) => sum + n, 0);
        return sum / numbers.length;
      }
      case "min": {
        const values = getArgumentValues(expression.argument);
        const numbers = values.filter((v) => typeof v === "number") as number[];
        if (numbers.length === 0) return undefined;
        return Math.min(...numbers);
      }
      case "max": {
        const values = getArgumentValues(expression.argument);
        const numbers = values.filter((v) => typeof v === "number") as number[];
        if (numbers.length === 0) return undefined;
        return Math.max(...numbers);
      }
      case "count": {
        const values = getArgumentValues(expression.argument);
        return values.length;
      }
      case "length": {
        if (expression.argument.type === "path") {
          const results = this.evaluatePathQuery(
            node,
            expression.argument.path
          );
          return results.length;
        }
        const value = getArgumentValue(expression.argument);
        if (value === undefined || value === null) return undefined;
        if (this.isArray(value)) return value.length;
        if (typeof value === "string") return value.length;
        return undefined;
      }
      case "contains": {
        const str = getArgumentValue(expression.argument);
        const substr = expression.argument2
          ? getArgumentValue(expression.argument2)
          : undefined;
        if (typeof str !== "string" || typeof substr !== "string") {
          return undefined;
        }
        return str.includes(substr);
      }
      case "startsWith": {
        const str = getArgumentValue(expression.argument);
        const prefix = expression.argument2
          ? getArgumentValue(expression.argument2)
          : undefined;
        if (typeof str !== "string" || typeof prefix !== "string") {
          return undefined;
        }
        return str.startsWith(prefix);
      }
      case "endsWith": {
        const str = getArgumentValue(expression.argument);
        const suffix = expression.argument2
          ? getArgumentValue(expression.argument2)
          : undefined;
        if (typeof str !== "string" || typeof suffix !== "string") {
          return undefined;
        }
        return str.endsWith(suffix);
      }
      case "matches": {
        const str = getArgumentValue(expression.argument);
        const pattern = expression.argument2
          ? getArgumentValue(expression.argument2)
          : undefined;
        if (typeof str !== "string" || typeof pattern !== "string") {
          return undefined;
        }
        try {
          const regex = new RegExp(pattern);
          return regex.test(str);
        } catch {
          return false;
        }
      }
      case "upper": {
        const str = getArgumentValue(expression.argument);
        if (typeof str !== "string") return undefined;
        return str.toUpperCase();
      }
      case "lower": {
        const str = getArgumentValue(expression.argument);
        if (typeof str !== "string") return undefined;
        return str.toLowerCase();
      }
      case "isNumber": {
        const value = getArgumentValue(expression.argument);
        return typeof value === "number";
      }
      case "isString": {
        const value = getArgumentValue(expression.argument);
        return typeof value === "string";
      }
      case "isBoolean": {
        const value = getArgumentValue(expression.argument);
        return typeof value === "boolean";
      }
      case "isArray": {
        const value = getArgumentValue(expression.argument);
        if (value === undefined) return false;
        return this.isArray(value);
      }
      case "isObject": {
        const value = getArgumentValue(expression.argument);
        if (value === undefined) return false;
        return this.isObject(value);
      }
      case "isNull": {
        const value = getArgumentValue(expression.argument);
        return value === null;
      }
      case "type": {
        const value = getArgumentValue(expression.argument);
        if (value === undefined) return "undefined";
        if (value === null) return "null";
        if (this.isArray(value)) return "array";
        if (this.isObject(value)) return "object";
        return typeof value;
      }
      default:
        return undefined;
    }
  }

  private compareValues(a: JsonValue, b: JsonValue): number {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b);
    }
    const aStr = String(a);
    const bStr = String(b);
    return aStr.localeCompare(bStr);
  }

  private isObject(value: JsonValue): value is JsonObject {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private isArray(value: JsonValue): value is JsonArray {
    return Array.isArray(value);
  }
}

interface Node {
  value: JsonValue;
  path: string;
}

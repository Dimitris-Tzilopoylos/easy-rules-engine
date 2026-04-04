export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type Selector =
  | RootSelector
  | NameSelector
  | IndexSelector
  | WildcardSelector
  | SliceSelector
  | FilterSelector
  | DescendantSelector
  | UnionSelector;

export interface RootSelector {
  type: "root";
}

export interface NameSelector {
  type: "name";
  name: string;
}

export interface IndexSelector {
  type: "index";
  index: number;
}

export interface WildcardSelector {
  type: "wildcard";
}

export interface SliceSelector {
  type: "slice";
  start?: number;
  end?: number;
  step?: number;
}

export interface FilterSelector {
  type: "filter";
  expression: FilterExpression;
}

export interface DescendantSelector {
  type: "descendant";
  selector: Selector;
}

export interface UnionSelector {
  type: "union";
  selectors: Selector[];
}

export type FilterExpression =
  | ComparisonExpression
  | LogicalExpression
  | ExistenceExpression
  | PathExpression
  | LiteralExpression
  | FunctionExpression;

export interface ComparisonExpression {
  type: "comparison";
  operator: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in";
  left: FilterExpression;
  right: FilterExpression;
}

export interface LogicalExpression {
  type: "logical";
  operator: "&&" | "||";
  left: FilterExpression;
  right: FilterExpression;
}

export interface ExistenceExpression {
  type: "existence";
  path: ParsedQuery;
}

export interface PathExpression {
  type: "path";
  path: ParsedQuery;
}

export interface LiteralExpression {
  type: "literal";
  value: JsonValue;
}

export interface FunctionExpression {
  type: "function";
  name:
    | "sum"
    | "avg"
    | "min"
    | "max"
    | "count"
    | "length"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "matches"
    | "upper"
    | "lower"
    | "isNumber"
    | "isString"
    | "isBoolean"
    | "isArray"
    | "isObject"
    | "isNull"
    | "type";
  argument: FilterExpression;
  argument2?: FilterExpression;
}

export interface QueryResult {
  path: string;
  value: JsonValue;
}

export interface ParsedQuery {
  selectors: Selector[];
}

import { Parser } from "./parser";
import { Evaluator } from "./evaluator";
import { type JsonValue, type QueryResult, type ParsedQuery } from "./types";

export function query(document: JsonValue, path: string): QueryResult[] {
  const parser = new Parser();
  const parsed = parser.parse(path);
  const evaluator = new Evaluator(document);
  return evaluator.evaluate(parsed);
}

export function parse(path: string): ParsedQuery {
  const parser = new Parser();
  return parser.parse(path);
}

export function values(document: JsonValue, path: string): JsonValue[] {
  return query(document, path).map((result) => result.value);
}

export function first(
  document: JsonValue,
  path: string,
): JsonValue | undefined {
  const results = query(document, path);
  return results.length > 0 ? results[0].value : undefined;
}

export function last(document: JsonValue, path: string): JsonValue | undefined {
  const results = query(document, path);
  return results.length > 0 ? results[results.length - 1].value : undefined;
}

export type {
  JsonValue,
  JsonObject,
  JsonArray,
  QueryResult,
  ParsedQuery,
  Selector,
} from "./types";

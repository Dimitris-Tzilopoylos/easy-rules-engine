import { type Selector, type ParsedQuery, type FilterExpression, type JsonValue } from "./types";

class Lexer {
  private input: string;
  private position: number = 0;
  private length: number;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  private peek(): string {
    if (this.position >= this.length) return "\0";
    return this.input[this.position];
  }

  private advance(): string {
    if (this.position >= this.length) return "\0";
    return this.input[this.position++];
  }

  private skipWhitespace(): void {
    while (
      this.position < this.length &&
      /\s/.test(this.input[this.position])
    ) {
      this.position++;
    }
  }

  private readString(): string {
    const quote = this.advance();
    let result = "";
    let escaped = false;

    while (this.position < this.length) {
      const char = this.advance();
      if (escaped) {
        if (char === "n") result += "\n";
        else if (char === "t") result += "\t";
        else if (char === "r") result += "\r";
        else if (char === "\\") result += "\\";
        else if (char === quote) result += quote;
        else result += char;
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        return result;
      } else {
        result += char;
      }
    }
    throw new Error("Unterminated string");
  }

  private readNumber(): string {
    let result = "";
    let hasDot = false;

    while (this.position < this.length) {
      const char = this.peek();
      if (char >= "0" && char <= "9") {
        result += this.advance();
      } else if (char === "." && !hasDot) {
        result += this.advance();
        hasDot = true;
      } else if (char === "-" && result === "") {
        result += this.advance();
      } else {
        break;
      }
    }
    return result;
  }

  private readIdentifier(): string {
    let result = "";
    while (this.position < this.length) {
      const char = this.peek();
      if (/[a-zA-Z0-9_$]/.test(char)) {
        result += this.advance();
      } else {
        break;
      }
    }
    return result;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    this.position = 0;

    while (this.position < this.length) {
      this.skipWhitespace();
      if (this.position >= this.length) break;

      const char = this.peek();

      if (char === "$") {
        tokens.push({ type: "ROOT", value: "$" });
        this.advance();
      } else if (char === ".") {
        this.advance();
        if (this.peek() === ".") {
          this.advance();
          tokens.push({ type: "DESCENDANT", value: ".." });
        } else {
          tokens.push({ type: "DOT", value: "." });
        }
      } else if (char === "[") {
        tokens.push({ type: "LBRACKET", value: "[" });
        this.advance();
      } else if (char === "]") {
        tokens.push({ type: "RBRACKET", value: "]" });
        this.advance();
      } else if (char === "*") {
        tokens.push({ type: "WILDCARD", value: "*" });
        this.advance();
      } else if (char === "?") {
        tokens.push({ type: "QUESTION", value: "?" });
        this.advance();
      } else if (char === "@") {
        tokens.push({ type: "AT", value: "@" });
        this.advance();
      } else if (char === "(") {
        tokens.push({ type: "LPAREN", value: "(" });
        this.advance();
      } else if (char === ")") {
        tokens.push({ type: "RPAREN", value: ")" });
        this.advance();
      } else if (char === ",") {
        tokens.push({ type: "COMMA", value: "," });
        this.advance();
      } else if (char === ":") {
        tokens.push({ type: "COLON", value: ":" });
        this.advance();
      } else if (char === "=" && this.input[this.position + 1] === "=") {
        tokens.push({ type: "EQ", value: "==" });
        this.advance();
        this.advance();
      } else if (char === "!" && this.input[this.position + 1] === "=") {
        tokens.push({ type: "NE", value: "!=" });
        this.advance();
        this.advance();
      } else if (char === "<" && this.input[this.position + 1] === "=") {
        tokens.push({ type: "LE", value: "<=" });
        this.advance();
        this.advance();
      } else if (char === ">" && this.input[this.position + 1] === "=") {
        tokens.push({ type: "GE", value: ">=" });
        this.advance();
        this.advance();
      } else if (char === "<") {
        tokens.push({ type: "LT", value: "<" });
        this.advance();
      } else if (char === ">") {
        tokens.push({ type: "GT", value: ">" });
        this.advance();
      } else if (char === "&" && this.input[this.position + 1] === "&") {
        tokens.push({ type: "AND", value: "&&" });
        this.advance();
        this.advance();
      } else if (char === "|" && this.input[this.position + 1] === "|") {
        tokens.push({ type: "OR", value: "||" });
        this.advance();
        this.advance();
      } else if (char === '"' || char === "'") {
        tokens.push({ type: "STRING", value: this.readString() });
      } else if ((char >= "0" && char <= "9") || char === "-") {
        tokens.push({ type: "NUMBER", value: this.readNumber() });
      } else if (/[a-zA-Z_$]/.test(char)) {
        const identifier = this.readIdentifier();
        tokens.push({ type: "IDENTIFIER", value: identifier });
      } else {
        throw new Error(
          `Unexpected character: ${char} at position ${this.position}`,
        );
      }
    }

    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }
}

interface Token {
  type: string;
  value: string;
}

export class Parser {
  private tokens: Token[] = [];
  private position: number = 0;

  parse(input: string): ParsedQuery {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.position = 0;

    const selectors: Selector[] = [];

    if (this.peek().type !== "ROOT") {
      throw new Error("JSONPath must start with $");
    }
    this.advance();
    selectors.push({ type: "root" });

    while (this.peek().type !== "EOF") {
      const selector = this.parseSelector();
      if (selector) {
        selectors.push(selector);
      } else {
        throw new Error(`Unexpected token: ${this.peek().type}`);
      }
    }

    return { selectors };
  }

  private peek(): Token {
    return this.tokens[this.position] || { type: "EOF", value: "" };
  }

  private advance(): Token {
    return this.tokens[this.position++] || { type: "EOF", value: "" };
  }

  private expect(type: string): Token {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return token;
  }

  private parseSelector(): Selector | null {
    const token = this.peek();

    if (token.type === "DOT") {
      this.advance();
      const next = this.peek();
      if (next.type === "WILDCARD") {
        this.advance();
        return { type: "wildcard" };
      } else if (next.type === "IDENTIFIER") {
        const name = this.advance().value;
        return { type: "name", name };
      } else {
        throw new Error("Expected identifier or wildcard after dot");
      }
    } else if (token.type === "DESCENDANT") {
      this.advance();
      const next = this.peek();
      let selector: Selector;
      if (next.type === "IDENTIFIER") {
        const name = this.advance().value;
        selector = { type: "name", name };
      } else if (next.type === "WILDCARD") {
        this.advance();
        selector = { type: "wildcard" };
      } else {
        const parsedSelector = this.parseSelector();
        if (!parsedSelector) {
          throw new Error("Expected selector after descendant");
        }
        selector = parsedSelector;
      }
      return { type: "descendant", selector };
    } else if (token.type === "LBRACKET") {
      this.advance();
      const selector = this.parseBracketSelector();
      this.expect("RBRACKET");
      return selector;
    } else if (token.type === "EOF") {
      return null;
    } else {
      return null;
    }
  }

  private parseBracketSelector(): Selector {
    const firstSelector = this.parseSingleBracketSelector();

    if (this.peek().type === "COMMA") {
      const selectors: Selector[] = [firstSelector];
      while (this.peek().type === "COMMA") {
        this.advance();
        selectors.push(this.parseSingleBracketSelector());
      }
      return { type: "union", selectors };
    }

    return firstSelector;
  }

  private parseSingleBracketSelector(): Selector {
    const token = this.peek();

    if (token.type === "WILDCARD") {
      this.advance();
      return { type: "wildcard" };
    } else if (token.type === "QUESTION") {
      this.advance();
      this.expect("LPAREN");
      const expression = this.parseFilterExpression();
      this.expect("RPAREN");
      return { type: "filter", expression };
    } else if (token.type === "STRING") {
      const name = this.advance().value;
      return { type: "name", name };
    } else if (token.type === "NUMBER") {
      if (this.lookahead(1)?.type === "COLON") {
        return this.parseSliceSelector();
      }
      const index = parseInt(this.advance().value, 10);
      return { type: "index", index };
    } else if (token.type === "COLON") {
      return this.parseSliceSelector();
    } else {
      throw new Error(`Unexpected token in bracket selector: ${token.type}`);
    }
  }

  private parseSliceSelector(): Selector {
    let start: number | undefined;
    let end: number | undefined;
    let step: number | undefined;

    if (this.peek().type === "NUMBER") {
      start = parseInt(this.advance().value, 10);
    }
    this.expect("COLON");
    if (this.peek().type === "NUMBER") {
      end = parseInt(this.advance().value, 10);
    }
    if (this.peek().type === "COLON") {
      this.advance();
      if (this.peek().type === "NUMBER") {
        step = parseInt(this.advance().value, 10);
      }
    }

    return { type: "slice", start, end, step };
  }

  private parseFilterExpression(): FilterExpression {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): FilterExpression {
    let left = this.parseLogicalAnd();
    while (this.peek().type === "OR") {
      this.advance();
      const right = this.parseLogicalAnd();
      left = {
        type: "logical",
        operator: "||",
        left,
        right,
      };
    }
    return left;
  }

  private parseLogicalAnd(): FilterExpression {
    let left = this.parseComparison();
    while (this.peek().type === "AND") {
      this.advance();
      const right = this.parseComparison();
      left = {
        type: "logical",
        operator: "&&",
        left,
        right,
      };
    }
    return left;
  }

  private parseComparison(): FilterExpression {
    const left = this.parseFilterValue();
    const token = this.peek();
    if (
      token.type === "EQ" ||
      token.type === "NE" ||
      token.type === "LT" ||
      token.type === "LE" ||
      token.type === "GT" ||
      token.type === "GE"
    ) {
      const operator = this.advance().value as
        | "=="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">=";
      const right = this.parseFilterValue();
      return {
        type: "comparison",
        operator,
        left,
        right,
      };
    }
    if (token.type === "IDENTIFIER" && token.value === "in") {
      this.advance();
      const right = this.parseFilterValue();
      return {
        type: "comparison",
        operator: "in",
        left,
        right,
      };
    }
    if (
      left.type === "path" &&
      (token.type === "RPAREN" || token.type === "EOF")
    ) {
      throw new Error(
        "Incomplete filter expression: path without comparison operator",
      );
    }
    return left;
  }

  private parseFilterValue(): FilterExpression {
    const token = this.peek();

    if (token.type === "AT") {
      this.advance();
      const path = this.parsePathInFilter();
      return { type: "path", path };
    } else if (token.type === "STRING") {
      const value = this.advance().value;
      return { type: "literal", value };
    } else if (token.type === "NUMBER") {
      const numValue = parseFloat(this.advance().value);
      return { type: "literal", value: numValue };
    } else if (token.type === "IDENTIFIER") {
      const identifier = this.advance().value;

      if (this.peek().type === "LPAREN") {
        const validFunctions = [
          "sum",
          "avg",
          "min",
          "max",
          "count",
          "length",
          "contains",
          "startsWith",
          "endsWith",
          "matches",
          "upper",
          "lower",
          "isNumber",
          "isString",
          "isBoolean",
          "isArray",
          "isObject",
          "isNull",
          "type",
        ];
        if (!validFunctions.includes(identifier)) {
          throw new Error(`Unknown function: ${identifier}`);
        }
        const functionName = identifier as
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
        this.advance();
        const argument = this.parseFilterValue();

        const needsSecondArg = [
          "contains",
          "startsWith",
          "endsWith",
          "matches",
        ];
        let argument2: FilterExpression | undefined;
        if (
          needsSecondArg.includes(functionName) &&
          this.peek().type === "COMMA"
        ) {
          this.advance();
          argument2 = this.parseFilterValue();
        }

        this.expect("RPAREN");
        return { type: "function", name: functionName, argument, argument2 };
      }

      if (identifier === "true") {
        return { type: "literal", value: true };
      } else if (identifier === "false") {
        return { type: "literal", value: false };
      } else if (identifier === "null") {
        return { type: "literal", value: null };
      } else {
        return { type: "literal", value: identifier };
      }
    } else if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseFilterExpression();
      this.expect("RPAREN");
      return expr;
    } else if (token.type === "LBRACKET") {
      this.advance();
      const arrayValues: FilterExpression[] = [];

      if (this.peek().type !== "RBRACKET") {
        arrayValues.push(this.parseFilterValue());
        while (this.peek().type === "COMMA") {
          this.advance();
          arrayValues.push(this.parseFilterValue());
        }
      }

      this.expect("RBRACKET");
      const values = arrayValues
        .map((expr) => {
          if (expr.type === "literal") {
            return expr.value;
          }
          return undefined;
        })
        .filter((v) => v !== undefined) as JsonValue[];
      return { type: "literal", value: values };
    } else {
      throw new Error(`Unexpected token in filter: ${token.type}`);
    }
  }

  private parsePathInFilter(): ParsedQuery {
    const selectors: Selector[] = [{ type: "root" }];

    const token = this.peek();
    if (
      token.type === "EQ" ||
      token.type === "NE" ||
      token.type === "LT" ||
      token.type === "LE" ||
      token.type === "GT" ||
      token.type === "GE" ||
      token.type === "AND" ||
      token.type === "OR" ||
      token.type === "RPAREN" ||
      token.type === "EOF"
    ) {
      return { selectors };
    }

    while (this.position < this.tokens.length) {
      const currentToken = this.peek();

      if (
        currentToken.type === "EQ" ||
        currentToken.type === "NE" ||
        currentToken.type === "LT" ||
        currentToken.type === "LE" ||
        currentToken.type === "GT" ||
        currentToken.type === "GE" ||
        currentToken.type === "AND" ||
        currentToken.type === "OR" ||
        currentToken.type === "RPAREN" ||
        currentToken.type === "EOF"
      ) {
        break;
      }

      const savedPosition = this.position;
      try {
        const selector = this.parseSelector();
        if (selector) {
          selectors.push(selector);
          if (this.position === savedPosition) {
            break;
          }
        } else {
          break;
        }
      } catch (e) {
        this.position = savedPosition;
        break;
      }
    }

    return { selectors };
  }

  private lookahead(offset: number): Token | null {
    const pos = this.position + offset;
    return pos < this.tokens.length ? this.tokens[pos] : null;
  }
}

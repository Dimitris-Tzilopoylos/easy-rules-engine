# easy-rules-engine

TypeScript library for evaluating JSON-friendly **rules** and **rule sets** against a context. Each leaf condition reads a **`field`** from the context (JSONPath-style via the built-in jspath helper) and compares it using pluggable **operators**. The right-hand side is either a literal **`value`** or another path **`valuePath`** resolved the same way as `field`.

## Requirements

- **Node.js** 18+ for runtime; **Node.js 22.4+** recommended for `npm test` (uses `node --test` with `--test-isolation=none`).

## Setup

```bash
npm install easy-rules-engine
```

For local development from a clone, use `npm install` in the repo root.

## Scripts

| Script            | Description |
| ----------------- | ----------- |
| `npm run build`   | Bundles `src/index.ts` to `dist/index.js` with esbuild and emits `.d.ts` with `tsc --emitDeclarationOnly`. |
| `npm run dev`     | Runs `src/index.ts` under `tsx watch`. |
| `npm start`       | Runs `node dist/index.js` (run `build` first). |
| `npm test`        | Runs the test suite (`test/all.test.ts`). |
| `npm run test:watch` | Same tests in watch mode. |

## Public API

The package exports **factories**, **types**, and **jspath** helpers. Everything you evaluate implements `Evaluatable` (`evaluate(context): boolean`). There are no public classes for rules/conditions (only the factory API).

| Factory | Purpose |
| ------- | ------- |
| `createContext(input)` | Build `IContext` with `input` as the data object paths resolve against. |
| `createRule(definition, options?)` | Single `IRule`. |
| `createRuleSet(definition, options?)` | Single `IRuleSet`. |
| `createEvaluable(definition, options?)` | `IRule` or `IRuleSet` (use when the shape is only known at runtime). |
| `createCondition(definition, options?)` | One `IBaseCondition` (leaf: `value` **or** `valuePath`) or `IBaseConditionGroup` without wrapping in `IRule`. |
| `createOperatorRegistry(handlers)` | Custom operators as a plain object; merged with defaults when passed in `options.operators`. |

| jspath (same engine as `field` / `valuePath`) | Purpose |
| --------------------------------------------- | ------- |
| `parse(path)` | Parse a path string to `ParsedQuery`. |
| `query(doc, path)` | Run path on a JSON document; returns `QueryResult[]`. |
| `values(doc, path)` | Values from `query`. |
| `first` / `last` | First or last match value. |
| `evaluateParsed` / `firstParsed` / `lastParsed` | Evaluate with an already-parsed query (reuse `ParsedQuery`). |

Types: `JsonValue`, `JsonObject`, `JsonArray`, `ParsedQuery`, `QueryResult`, `Selector`.

Optional second argument on rule/condition factories: `{ operators?: OperatorRegistry }`. Produce that registry with **`createOperatorRegistry({ ... })`** (see below).

## Usage

```typescript
import { createContext, createRule } from "easy-rules-engine";

const rule = createRule({
  id: "example",
  type: "permissive",
  conditions: [
    { field: "$.status", operator: "eq", value: "active" },
    {
      operator: "and",
      conditions: [
        { field: "$.score", operator: "gte", value: 10 },
        { field: "$.role", operator: "neq", value: "guest" },
        // Compare two inputs: field vs path (same resolution rules as `field`)
        { field: "$.password", operator: "eq", valuePath: "passwordConfirm" },
      ],
    },
  ],
});

rule.evaluate(
  createContext({
    status: "active",
    score: 15,
    role: "user",
    password: "hunter2",
    passwordConfirm: "hunter2",
  }),
);
```

After install, import from `easy-rules-engine`. For a local link, use `npm link`, `"file:../path"`, or your workspace setup.

### Context and paths

`IContext` is an object with at least `input: Record<string, unknown>` (and optional extra keys).

**Resolving `field` and `valuePath`** (same rules for both):

- If the string **names a key on `input`** (same idea as the `in` operator), the value is read from that property. **JSONPath is not mandatory** — e.g. use `status` when `input` has a root property `status`, instead of `$.status`.
- Otherwise the string is passed to the **JSONPath-style path engine** as given (for example `$.user.tier`).

**Leaf conditions (`IBaseCondition`)** extend `IBaseConditionCore` (`field`, `operator`) with **exactly one** of:

| Property      | Role |
| ------------- | ---- |
| **`value`**   | Literal right-hand side passed to the operator after `field` is resolved. |
| **`valuePath`** | Path string; resolved from `context.input` like `field`. The result is the right-hand side. |

Do not set both `value` and `valuePath` on the same condition; `createCondition` and rule factories throw when the shape is invalid (neither or both).

At runtime, **custom operators** always receive the already-resolved right-hand side as `value` in their handler args (whether it came from a literal or from `valuePath`).

### Rules and rule sets

- **`IRule`**: `id`, `type` (`permissive` | `restrictive`), and a flat list of **conditions** (each item is either a single condition or a nested **group**).
- **`IBaseConditionGroup`**: `operator` is `and`, `or`, or `not`, plus a `conditions` array (nested conditions or groups).
- **`IRuleSet`**: `id` and `rules` — each entry is another `IRule` or nested `IRuleSet`. Evaluation requires **every** child rule/set to pass.

Use `createRule` / `createRuleSet`, or `createEvaluable` when you have either an `IRule` or `IRuleSet`.

### Built-in operators

| Operator     | Meaning (resolved **left** = `field`, resolved **right** = `value` or path → `valuePath`) |
| ------------ | ---------------------------------------------------------------------------------------- |
| `eq` / `neq` | Strict equality / inequality |
| `gt`, `gte`, `lt`, `lte` | Relational (coerced as `string \| number` for comparison) |
| `contains`   | If `value` is a **string**, substring check `value.includes(String(fieldValue))`. Otherwise `value` is normalized to a list (see below) and `fieldValue` is tested with `Array#includes`. |
| `ncontains`  | `String(fieldValue ?? "")` does **not** include `String(value)` as substring (no throw on non-strings). |
| `all` / `any` | `value` is normalized to a list; **every** / **some** element **strictly equals** `fieldValue`. |
| `nany` / `none` | Same list as `any`; `nany` / `none` negate membership of `fieldValue` in that list. |
| `in` / `nin` | Same list normalization as `any`; `Array#includes` / negated on `fieldValue`. |
| `startsWith` / `endsWith` | Both sides strings: `fieldValue.startsWith/endsWith(value)` |
| `matches`    | Right-hand side is a regex **pattern string**; `String(fieldValue)` is tested (invalid pattern → false) |
| `between`    | Right-hand side is `[lo, hi]`; numeric `fieldValue` is **inclusive** between `Number(lo)` and `Number(hi)` |
| `defined`    | `fieldValue` is not `null` and not `undefined` (`value` ignored) |
| `blank`      | `null`, `undefined`, whitespace-only string, empty array, or plain object with no keys |
| `notBlank`   | Negation of `blank` (`value` ignored) |
| `isOfType`   | Right-hand side is a string; JavaScript `typeof fieldValue === value` (note: `typeof null === "object"`) |

**List normalization** (for `contains` when `value` is not a string, and for `all`, `any`, `nany`, `none`, `in`, `nin`): `null` / `undefined` → `[]`; arrays used as-is; `Set` → spread elements; `Map` → values; **strings** (only for these operators, not the `contains` substring case) → single-element `[value]`; other **iterables** (e.g. typed arrays) → spread; anything else → `[value]`.

Unknown operator names throw at evaluation time.

### Custom operators

Handlers receive `{ fieldValue, value, condition, context }` and return a boolean. Here **`value`** is the resolved right-hand side (literal or read via `valuePath`). The full **`condition`** object is still available if you need to distinguish `value` vs `valuePath` in metadata.

Custom registries are **merged on top of the defaults**: pass **`createOperatorRegistry({ ... })`** so only custom handlers are listed; built-ins stay available unless you override a name. Names `and`, `or`, and `not` are reserved for groups.

```typescript
import { createOperatorRegistry, createRule } from "easy-rules-engine";

const operators = createOperatorRegistry({
  startsWith: ({ fieldValue, value }) =>
    typeof fieldValue === "string" &&
    typeof value === "string" &&
    fieldValue.startsWith(value),
});

const rule = createRule(
  {
    id: "custom",
    type: "permissive",
    conditions: [{ field: "$.name", operator: "startsWith", value: "Al" }],
  },
  { operators },
);
```

Registry factories: **`createOperatorRegistry(handlers)`** (custom ops), **`createDefaultOperatorRegistry()`** (built-ins only). Lower-level: `mergeWithDefaultOperators`, `resolveOperators`, `OperatorRegistry.merge`.

### Rule types

- **`permissive`**: all top-level conditions/groups must evaluate to `true`.
- **`restrictive`**: current implementation returns `true` when at least one condition fails; if **all** conditions pass, evaluation throws `Invalid rule type`. Treat this as a known limitation if you need different semantics.

## Project layout

```
src/
  index.ts           # Re-exports factory, operators, types, jspath helpers
  lib/
    types.ts         # IRule, IBaseCondition (value XOR valuePath), IContext, Evaluatable, …
    operators.ts     # OperatorRegistry and built-ins
    condition.ts     # Internal condition tree (used by factory)
    rule.ts          # Internal rule engine (used by factory)
    factory.ts       # createRule, createRuleSet, createEvaluable, createCondition, createContext
    jspath/          # Path parsing and evaluation for `field` and `valuePath`
test/
  all.test.ts        # Loads all suites
  condition.test.ts  # Operators, createCondition, groups (flat)
  nested.test.ts     # Deep groups, rules, rule sets, empty groups
  rule.test.ts       # Permissive / restrictive, createEvaluable
  jspath.test.ts     # Paths, parse, integration with conditions
```

## TypeScript

- Source uses `moduleResolution: "bundler"` and extensionless relative imports; **esbuild** produces a single Node ESM bundle under `dist/`.
- Check types: `npx tsc --noEmit` (project `include` is `src/**/*.ts` only).

## License

[MIT](LICENSE). See `package.json` field `"license": "MIT"`.

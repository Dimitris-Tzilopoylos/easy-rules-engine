# easy-rules-engine

TypeScript library for evaluating JSON-friendly **rules** and **rule sets** against a context. Each leaf condition reads a **`field`** from the context (JSONPath-style via the built-in jspath helper) and compares it using pluggable **operators**. The right-hand side is either a literal **`value`** or another path **`valuePath`** resolved the same way as `field`.

## Requirements

- **Node.js** 18+ for runtime; **Node.js 22.4+** recommended for `npm test` (uses `node --test` with `--test-isolation=none`).

## Setup

```bash
npm install easy-rules-engine zod
```

`zod` is a **required peer dependency**: factories run schema validation on every `createRule`, `createEvaluable`, `createContext`, etc., so your app must install a compatible `zod` version (see `peerDependencies` in this package).

For local development from a clone, use `npm install` in the repo root.

## Scripts

| Script            | Description |
| ----------------- | ----------- |
| `npm run build`   | Bundles `src/index.ts` to `dist/index.js` with esbuild (`zod` external) and emits `.d.ts` with `tsc --emitDeclarationOnly`. |
| `npm run dev`     | Runs `src/index.ts` under `tsx watch`. |
| `npm start`       | Runs `node dist/index.js` (run `build` first). |
| `npm test`        | Runs the test suite (`test/all.test.ts`). |
| `npm run test:watch` | Same tests in watch mode. |

## Public API

The package exports **factories**, **types**, and **jspath** helpers. Everything you evaluate implements `Evaluatable`: synchronous **`evaluate(context): boolean`** and **`evaluateAsync(context): Promise<boolean>`** for trees that include async custom operators. There are no public classes for rules/conditions (only the factory API).

If a custom operator returns a **`Promise<boolean>`**, you must use **`evaluateAsync`**. Calling **`evaluate`** in that case throws (so a Promise is never mistaken for a truthy boolean).

| Factory | Purpose |
| ------- | ------- |
| `createContext(data)` | Validates then returns `IContext`. `data` may be a full context `{ input, ... }` or the shorthand plain object used as `input` only (same as before). |
| `createRule(data, options?)` | Validates with Zod (`ruleSchema`), then builds a rule evaluatable. |
| `createRuleSet(data, options?)` | Validates with `ruleSetSchema`. |
| `createEvaluable(data, options?)` | Validates with `evaluableSchema` (`IRule` or `IRuleSet`). |
| `createCondition(data, options?)` | Validates with `conditionSchema`. |
| `createOperatorRegistry(handlers)` | Custom operators as a plain object; merged with defaults when passed in `options.operators`. |

Invalid shapes throw **`ZodError`**. You can also use **`safeParseRule`**, **`safeParseEvaluable`**, etc., or the exported **`ruleSchema`**, **`conditionSchema`**, … for custom pipelines.

| jspath (same engine as `field` / `valuePath`) | Purpose |
| --------------------------------------------- | ------- |
| `parse(path)` | Parse a path string to `ParsedQuery`. |
| `query(doc, path)` | Run path on a JSON document; returns `QueryResult[]`. |
| `values(doc, path)` | Values from `query`. |
| `first` / `last` | First or last match value. |
| `evaluateParsed` / `firstParsed` / `lastParsed` | Evaluate with an already-parsed query (reuse `ParsedQuery`). |

Types: `JsonValue`, `JsonObject`, `JsonArray`, `ParsedQuery`, `QueryResult`, `Selector`.

Optional second argument on rule/condition factories: `{ operators?: OperatorRegistry }`. Produce that registry with **`createOperatorRegistry({ ... })`** (see below).

### Zod (peer dependency)

The same **`ruleSchema`**, **`parseRule`**, **`safeParseRule`**, etc., used by factories are exported from **`easy-rules-engine`** for tests, custom error formatting, or parse-then-inspect workflows. Calling **`createRule(raw)`** is equivalent to validating with **`ruleSchema`** (or **`parseRule`**) and then constructing the engine object—factories always validate first.

Rules match **`ConditionFactory`**: groups use `{ operator: "and" \| "or" \| "not", conditions }`; leaves use **`field`**, **`operator`** (not the three group names), and exactly one of **`value`** or **`valuePath`**. Schemas use **`.strict()`** where noted so stray keys fail. Operator **names** are not validated by Zod; unknown operators still fail at **`evaluate`** / **`evaluateAsync`**.

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

**`createContext`**: you may pass that full shape, or pass a plain object that is validated as `context.input` (the usual `createContext({ status: "ok" })` style).

**Resolving `field` and `valuePath`** (same rules for both):

- If the string **names a key on `input`** (same idea as the `in` operator), the value is read from that property. **JSONPath is not mandatory** — e.g. use `status` when `input` has a root property `status`, instead of `$.status`.
- Otherwise the string is passed to the **JSONPath-style path engine** as given (for example `$.user.tier`).

**Leaf conditions (`IBaseCondition`)** extend `IBaseConditionCore` (`field`, `operator`) with **exactly one** of:

| Property      | Role |
| ------------- | ---- |
| **`value`**   | Literal right-hand side passed to the operator after `field` is resolved. |
| **`valuePath`** | Path string; resolved from `context.input` like `field`. The result is the right-hand side. |

Do not set both `value` and `valuePath` on the same condition; Zod rejects that shape when calling `createCondition` / `createRule` / … (throws `ZodError`).

At runtime, **custom operators** always receive the already-resolved right-hand side as `value` in their handler args (whether it came from a literal or from `valuePath`).

### Rules and rule sets

- **`IRule`**: `id`, `type` (`permissive` | `restrictive`), and a flat list of **conditions** (each item is either a single condition or a nested **group**).
- **`IBaseConditionGroup`**: `operator` is `and`, `or`, or `not`, plus a `conditions` array. Each element may be another **leaf** condition or a **nested group** — there is **no fixed depth limit**; evaluation walks the tree recursively.
- **`IRuleSet`**: `id` and `rules` — each entry is another `IRule` or nested `IRuleSet`. Evaluation requires **every** child rule/set to pass.

**Semantics:** `and` = every child true · `or` = some child true · `not` = no child true (same as `!some(...)` over children). Empty `and` → true, empty `or` → false, empty `not` → true.

Use `createRule` / `createRuleSet`, or `createEvaluable` when you have either an `IRule` or `IRuleSet`.

**Nested groups example** (JSON-friendly; also validated by Zod when passed to `createRule`):

```json
{
  "operator": "and",
  "conditions": [
    { "field": "region", "operator": "eq", "value": "eu" },
    {
      "operator": "or",
      "conditions": [
        {
          "operator": "and",
          "conditions": [
            { "field": "role", "operator": "eq", "value": "admin" },
            { "field": "tier", "operator": "eq", "value": "gold" }
          ]
        },
        {
          "operator": "and",
          "conditions": [
            { "field": "role", "operator": "eq", "value": "user" },
            { "field": "tier", "operator": "eq", "value": "gold" }
          ]
        }
      ]
    }
  ]
}
```

`evaluate` and `evaluateAsync` use the same logic (including short-circuiting on `and` / `or` / `not` in async mode).

### Built-in operators

Resolved **left** = value read from **`field`**; resolved **right** = **`value`** or the value read from **`valuePath`**.

**All default names** (24, same as the `KnownConditionOperator` type and `createDefaultOperatorRegistry()`):

`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `ncontains`, `all`, `any`, `nany`, `none`, `in`, `nin`, `startsWith`, `endsWith`, `matches`, `between`, `defined`, `blank`, `notBlank`, `isOfType`

In rule JSON, the operator string for set membership is **`"in"`**. The package also exports a helper **`isIn`** (because `in` is a reserved word in JavaScript) that builds a condition with `operator: "in"`.

| Operator | Meaning |
| -------- | ------- |
| `eq` | Strict equality: `fieldValue === value`. |
| `neq` | Strict inequality: `fieldValue !== value`. |
| `gt` | `fieldValue > value` after both are used as `string \| number` (no extra coercion beyond TypeScript’s comparison rules). |
| `gte` | `fieldValue >= value` (same typing as `gt`). |
| `lt` | `fieldValue < value` (same typing as `gt`). |
| `lte` | `fieldValue <= value` (same typing as `gt`). |
| `contains` | If `value` is a **string**: `value.includes(String(fieldValue))` (substring in the RHS string). Otherwise `value` is normalized to a **list** (see below) and the check is `list.includes(fieldValue)`. |
| `ncontains` | `String(fieldValue ?? "")` does **not** contain `String(value)` as a substring. |
| `all` | Normalize `value` to a list; **every** list element satisfies `item === fieldValue`. |
| `any` | Normalize `value` to a list; **some** list element satisfies `item === fieldValue`. |
| `nany` | Negation of `any`: no list element strictly equals `fieldValue`. |
| `none` | Same implementation as `nany` (alias). |
| `in` | Normalize `value` to a list; `list.includes(fieldValue)`. |
| `nin` | Normalize `value` to a list; `fieldValue` is **not** in the list. |
| `startsWith` | Both sides must be strings; `fieldValue.startsWith(value)`. |
| `endsWith` | Both sides must be strings; `fieldValue.endsWith(value)`. |
| `matches` | `value` must be a string (regex pattern); `new RegExp(value).test(String(fieldValue))`. Invalid pattern → `false`. |
| `between` | `value` must be a two-element array `[lo, hi]`. `Number(fieldValue)` must be finite; inclusive range between `Number(lo)` and `Number(hi)`. Wrong shape or non-numeric bounds → `false`. |
| `defined` | `fieldValue` is neither `null` nor `undefined` (`value` ignored). |
| `blank` | `null`, `undefined`, whitespace-only string, empty array, or plain object with no own keys. |
| `notBlank` | Negation of `blank` (`value` ignored). |
| `isOfType` | `value` must be a string; `typeof fieldValue === value` (e.g. `"string"`, `"number"`; note `typeof null === "object"` in JS). |

**List normalization** (used by `contains` when `value` is not a string, and by `all`, `any`, `nany`, `none`, `in`, `nin`): `null` / `undefined` → `[]`; arrays as-is; `Set` → elements; `Map` → values; **strings** → `[value]`; other **iterables** (when spreadable) → spread; otherwise → `[value]`.

Unknown operator names throw at evaluation time.

### Custom operators

Handlers receive `{ fieldValue, value, condition, context }` and return **`boolean`** or **`Promise<boolean>`** (for I/O such as password checks). Here **`value`** is the resolved right-hand side (literal or read via `valuePath`). The full **`condition`** object is still available if you need to distinguish `value` vs `valuePath` in metadata. Use **`evaluateAsync`** when any handler in the tree can be async.

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

## Testing

Run **`npm test`** (Node’s built-in test runner with **`tsx`**). Entry point is **`test/all.test.ts`**, which loads every suite.

| Suite | Focus |
| ----- | ----- |
| **`contract.test.ts`** | `evaluate` / `evaluateAsync` parity (including deep **`and` / `or` / `not`** trees), Zod `safeParse` error paths, JSON round-trip, every **`KnownConditionOperator`** accepted by **`conditionSchema`**, registry invariants |
| **`schemas.test.ts`** | Schema acceptance/rejection, factories + Zod, context shorthand vs full `IContext` |
| **`condition.test.ts`** | Built-in operators and custom registry behavior on conditions |
| **`rule.test.ts`** | Permissive / restrictive rules, rule sets, async operators |
| **`nested.test.ts`**, **`jspath.test.ts`**, **`edge-cases.test.ts`**, **`exhaustive.test.ts`** | Nested condition groups (sync + async parity), rule/rule-set trees, paths, edge cases |

Shared payloads live under **`test/fixtures/`** for reuse across suites.

## Project layout

```
src/
  index.ts           # Re-exports factory, operators, types, jspath helpers
  schemas.ts         # Zod schemas + parsers (used by factories; re-exported from index)
  lib/
    types.ts         # IRule, IBaseCondition (value XOR valuePath), IContext, Evaluatable, …
    operators.ts     # OperatorRegistry and built-ins
    condition.ts     # Internal condition tree (used by factory)
    rule.ts          # Internal rule engine (used by factory)
    factory.ts       # createRule, createRuleSet, createEvaluable, createCondition, createContext
    jspath/          # Path parsing and evaluation for `field` and `valuePath`
test/
  all.test.ts        # Loads all suites
  contract.test.ts   # Cross-cutting contracts (sync/async parity, Zod, operators list)
  condition.test.ts  # Operators, createCondition, groups (flat)
  edge-cases.test.ts
  exhaustive.test.ts
  fixtures/          # Shared rule / rule-set JSON-style fixtures
  nested.test.ts     # Deep groups, rules, rule sets, empty groups
  rule.test.ts       # Permissive / restrictive, createEvaluable, evaluateAsync
  schemas.test.ts    # Zod schemas vs engine types
  jspath.test.ts     # Paths, parse, integration with conditions
```

## TypeScript

- Source uses `moduleResolution: "bundler"` and extensionless relative imports; **esbuild** produces a single Node ESM bundle under `dist/`.
- Check types: `npx tsc --noEmit` (project `include` is `src/**/*.ts` only).

## License

[MIT](LICENSE). See `package.json` field `"license": "MIT"`.

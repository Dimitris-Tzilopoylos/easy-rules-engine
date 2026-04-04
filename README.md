# easy-rules-engine

TypeScript library for evaluating JSON-friendly **rules** and **rule sets** against a context. Conditions use a JSONPath-style **`field`** path (via the built-in jspath helper) and pluggable **operators**, including a default set you can extend or override.

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

The package exports **factory functions** and **types** only. Everything you evaluate implements `Evaluatable` (`evaluate(context): boolean`). There are no public classes.

| Factory | Purpose |
| ------- | ------- |
| `createContext(input)` | Build `IContext` with `input` as the data object paths resolve against. |
| `createRule(definition, options?)` | Single `IRule`. |
| `createRuleSet(definition, options?)` | Single `IRuleSet`. |
| `createEvaluable(definition, options?)` | `IRule` or `IRuleSet` (use when the shape is only known at runtime). |
| `createCondition(definition, options?)` | One `IBaseCondition` or `IBaseConditionGroup` without wrapping in `IRule`. |
| `createOperatorRegistry(handlers)` | Custom operators as a plain object; merged with defaults when passed in `options.operators`. |

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
      ],
    },
  ],
});

rule.evaluate(
  createContext({ status: "active", score: 15, role: "user" }),
);
```

After install, import from `easy-rules-engine`. For a local link, use `npm link`, `"file:../path"`, or your workspace setup.

### Context

`IContext` is an object with at least `input: Record<string, unknown>` (and optional extra keys). Each condition’s **`field`** is resolved against `context.input` as follows:

- If **`field` names a key on `input`** (same idea as the `in` operator), the value is read directly from that property. **JSONPath is not mandatory then** — e.g. use `status` when `input` has a root property `status`, instead of `$.status`.
- Otherwise **`field` is passed to the JSONPath-style path engine** as given (for example `$.user.tier`).

### Rules and rule sets

- **`IRule`**: `id`, `type` (`permissive` | `restrictive`), and a flat list of **conditions** (each item is either a single condition or a nested **group**).
- **`IBaseConditionGroup`**: `operator` is `and`, `or`, or `not`, plus a `conditions` array (nested conditions or groups).
- **`IRuleSet`**: `id` and `rules` — each entry is another `IRule` or nested `IRuleSet`. Evaluation requires **every** child rule/set to pass.

Use `createRule` / `createRuleSet`, or `createEvaluable` when you have either an `IRule` or `IRuleSet`.

### Built-in operators

| Operator     | Meaning (field value vs `value` from the condition) |
| ------------ | ---------------------------------------------------- |
| `eq` / `neq` | Strict equality / inequality                         |
| `gt`, `gte`, `lt`, `lte` | Relational (coerced as `string \| number` for comparison) |
| `contains`   | `condition.value` is array-like with `.includes(fieldValue)` |
| `ncontains`  | `fieldValue` is string-like; does not include `condition.value` as substring |
| `all` / `any` | Array `value`: every / some element equals field value |
| `nany` / `none` | Array `value`: no element equals field value      |

Unknown operator names throw at evaluation time.

### Custom operators

Handlers receive `{ fieldValue, value, condition, context }` and return a boolean.

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
  index.ts           # Re-exports factory, operators, types (no classes)
  lib/
    types.ts         # Rule / condition / context types, Evaluatable
    operators.ts     # OperatorRegistry and built-ins
    condition.ts     # Internal condition tree (used by factory)
    rule.ts          # Internal rule engine (used by factory)
    factory.ts       # createRule, createRuleSet, createEvaluable, createCondition, createContext
    jspath/          # Path parsing and evaluation for `field`
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCondition, createContext } from "../src/lib/factory";
import { first, last, parse, query, values } from "../src/lib/jspath";
import { cond } from "./helpers";

describe("jspath", () => {
  it("reads a top-level property with $.name", () => {
    const doc = { name: "Ada", count: 2 };
    assert.equal(first(doc, "$.name"), "Ada");
    assert.equal(first(doc, "$.count"), 2);
  });

  it("reads nested object paths", () => {
    const doc = { user: { profile: { id: 99, role: "admin" } } };
    assert.equal(first(doc, "$.user.profile.id"), 99);
    assert.equal(first(doc, "$.user.profile.role"), "admin");
  });

  it("returns undefined when path misses", () => {
    assert.equal(first({ a: 1 }, "$.missing"), undefined);
  });

  it("query returns nodes with paths", () => {
    const doc = { items: [{ id: 1 }, { id: 2 }] };
    const results = query(doc, "$.items[*].id");
    assert.ok(results.length >= 1);
    assert.ok(results.map((r) => r.value).includes(1));
  });

  it("values maps query to values", () => {
    const doc = { tags: ["x", "y"] };
    const v = values(doc, "$.tags[*]");
    assert.ok(v.includes("x"));
    assert.ok(v.includes("y"));
  });

  it("last returns final match for wildcard path", () => {
    const doc = { items: [{ n: 1 }, { n: 2 }, { n: 3 }] };
    assert.equal(last(doc, "$.items[*].n"), 3);
  });

  it("parse produces a query with selectors", () => {
    const parsed = parse("$.a.b");
    assert.ok(parsed.selectors.length >= 1);
  });
});

describe("jspath used from conditions", () => {
  it("evaluates conditions on nested input paths", () => {
    const c = createCondition(cond("$.user.tier", "eq", "gold"));
    assert.equal(
      c.evaluate(createContext({ user: { tier: "gold" } })),
      true,
    );
    assert.equal(
      c.evaluate(createContext({ user: { tier: "silver" } })),
      false,
    );
  });
});

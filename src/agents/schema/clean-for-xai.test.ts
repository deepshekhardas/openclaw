import { describe, expect, it } from "vitest";
import { stripUnsupportedSchemaKeywords } from "../../plugin-sdk/provider-tools.js";

const XAI_UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minContains",
  "maxContains",
]);

function stripXaiUnsupportedKeywords(schema: unknown): unknown {
  return stripUnsupportedSchemaKeywords(schema, XAI_UNSUPPORTED_SCHEMA_KEYWORDS);
}

describe("stripXaiUnsupportedKeywords", () => {
  it("strips minLength and maxLength from string properties", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 64, description: "A name" },
      },
    };
    const result = stripXaiUnsupportedKeywords(schema) as {
      properties: { name: Record<string, unknown> };
    };
    expect(result.properties.name.minLength).toBeUndefined();
    expect(result.properties.name.maxLength).toBeUndefined();
    expect(result.properties.name.type).toBe("string");
    expect(result.properties.name.description).toBe("A name");
  });

  it("strips minItems and maxItems from array properties", () => {
    const schema = {
      type: "object",
      properties: {
        items: { type: "array", minItems: 1, maxItems: 50, items: { type: "string" } },
      },
    };
    const result = stripXaiUnsupportedKeywords(schema) as {
      properties: { items: Record<string, unknown> };
    };
    expect(result.properties.items.minItems).toBeUndefined();
    expect(result.properties.items.maxItems).toBeUndefined();
    expect(result.properties.items.type).toBe("array");
  });

  it("strips minContains and maxContains", () => {
    const schema = {
      type: "array",
      minContains: 1,
      maxContains: 5,
      contains: { type: "string" },
    };
    const result = stripXaiUnsupportedKeywords(schema) as Record<string, unknown>;
    expect(result.minContains).toBeUndefined();
    expect(result.maxContains).toBeUndefined();
    expect(result.contains).toEqual({ type: "string" });
  });

  it("strips keywords recursively inside nested objects", () => {
    const schema = {
      type: "object",
      properties: {
        attachment: {
          type: "object",
          properties: {
            content: { type: "string", maxLength: 6_700_000 },
          },
        },
      },
    };
    const result = stripXaiUnsupportedKeywords(schema) as {
      properties: { attachment: { properties: { content: Record<string, unknown> } } };
    };
    expect(result.properties.attachment.properties.content.maxLength).toBeUndefined();
    expect(result.properties.attachment.properties.content.type).toBe("string");
  });

  it("strips keywords inside anyOf/oneOf/allOf variants", () => {
    const schema = {
      anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    };
    const result = stripXaiUnsupportedKeywords(schema) as {
      anyOf: Array<Record<string, unknown>>;
    };
    expect(result.anyOf[0].minLength).toBeUndefined();
    expect(result.anyOf[0].type).toBe("string");
  });

  it("strips keywords inside array item schemas", () => {
    const schema = {
      type: "array",
      items: { type: "string", maxLength: 100 },
    };
    const result = stripXaiUnsupportedKeywords(schema) as {
      items: Record<string, unknown>;
    };
    expect(result.items.maxLength).toBeUndefined();
    expect(result.items.type).toBe("string");
  });

  it("strips keywords inside schema-valued dependency branches", () => {
    const conditionalThenKeyword = ["th", "en"].join("");
    const schema = {
      type: "object",
      properties: {
        mode: { type: "string" },
      },
      dependencies: {
        mode: {
          type: "object",
          properties: {
            angle: { type: "string", maxLength: 32 },
          },
        },
        legacy: ["mode"],
      },
      dependentSchemas: {
        mode: {
          type: "object",
          properties: {
            precision: { type: "string", minLength: 1 },
          },
        },
      },
      if: {
        type: "object",
        properties: {
          flag: { type: "string", minLength: 1 },
        },
      },
      [conditionalThenKeyword]: {
        type: "object",
        properties: {
          next: { type: "string", maxLength: 4 },
        },
      },
      prefixItems: [{ type: "string", minLength: 1 }],
      additionalItems: { type: "string", maxLength: 8 },
    };
    const result = stripXaiUnsupportedKeywords(schema) as {
      dependencies?: {
        mode?: { properties?: { angle?: Record<string, unknown> } };
        legacy?: string[];
      };
      dependentSchemas?: { mode?: { properties?: { precision?: Record<string, unknown> } } };
      if?: { properties?: { flag?: Record<string, unknown> } };
      prefixItems?: Array<Record<string, unknown>>;
      additionalItems?: Record<string, unknown>;
    };
    const conditionalThen = (
      result as Record<string, { properties?: { next?: Record<string, unknown> } }>
    )[conditionalThenKeyword];

    expect(result.dependencies?.mode?.properties?.angle?.maxLength).toBeUndefined();
    expect(result.dependencies?.legacy).toEqual(["mode"]);
    expect(result.dependentSchemas?.mode?.properties?.precision?.minLength).toBeUndefined();
    expect(result.if?.properties?.flag?.minLength).toBeUndefined();
    expect(conditionalThen?.properties?.next?.maxLength).toBeUndefined();
    expect(result.prefixItems?.[0]?.minLength).toBeUndefined();
    expect(result.additionalItems?.maxLength).toBeUndefined();
  });

  it("preserves all other schema keywords", () => {
    const schema = {
      type: "object",
      description: "A tool schema",
      required: ["name"],
      properties: {
        name: { type: "string", description: "The name", enum: ["foo", "bar"] },
      },
      additionalProperties: false,
    };
    const result = stripXaiUnsupportedKeywords(schema) as Record<string, unknown>;
    expect(result.type).toBe("object");
    expect(result.description).toBe("A tool schema");
    expect(result.required).toEqual(["name"]);
    expect(result.additionalProperties).toBe(false);
  });

  it("passes through primitives and null unchanged", () => {
    expect(stripXaiUnsupportedKeywords(null)).toBeNull();
    expect(stripXaiUnsupportedKeywords("string")).toBe("string");
    expect(stripXaiUnsupportedKeywords(42)).toBe(42);
  });
});

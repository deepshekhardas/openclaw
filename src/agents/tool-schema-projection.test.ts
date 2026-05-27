import { describe, expect, it } from "vitest";
import {
  filterRuntimeCompatibleTools,
  inspectRuntimeToolInputSchemas,
  projectRuntimeToolInputSchema,
} from "./tool-schema-projection.js";

describe("runtime tool input schema projection", () => {
  it("accepts JSON object input schemas", () => {
    expect(
      projectRuntimeToolInputSchema({
        type: "object",
        properties: {
          angle: { type: "number" },
          scope: { type: "string" },
          token: { type: "string" },
          tuple: {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
          },
        },
        dependencies: {
          token: ["scope"],
        },
      }),
    ).toEqual({
      schema: {
        type: "object",
        properties: {
          angle: { type: "number" },
          scope: { type: "string" },
          token: { type: "string" },
          tuple: {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
          },
        },
        dependencies: {
          token: ["scope"],
        },
      },
      violations: [],
    });
  });

  it("reports non-object dynamic tool input schemas", () => {
    expect(
      inspectRuntimeToolInputSchemas([
        {
          name: "fuzz_move_angles",
          parameters: { type: "array", items: { type: "number" } },
        },
      ] as never),
    ).toEqual([
      {
        toolName: "fuzz_move_angles",
        toolIndex: 0,
        violations: ['fuzz_move_angles.parameters.type must be "object"'],
      },
    ]);
  });

  it("reports malformed nested schema keywords before runtime projection fails", () => {
    expect(
      projectRuntimeToolInputSchema(
        {
          type: "object",
          definitions: [],
          properties: {
            missing: null,
            invalid: 123,
            tuple: {
              type: "array",
              items: [{ type: "string" }],
              additionalItems: null,
            },
          },
          anyOf: null,
          dependencies: {
            token: [1],
          },
          items: null,
          required: [1],
        },
        "fuzz_move_angles.inputSchema",
      ).violations,
    ).toEqual([
      "fuzz_move_angles.inputSchema.definitions must be a schema map object",
      "fuzz_move_angles.inputSchema.dependencies.token[0] must be a string",
      "fuzz_move_angles.inputSchema.properties.missing must be a JSON Schema object or boolean",
      "fuzz_move_angles.inputSchema.properties.invalid must be a JSON Schema object or boolean",
      "fuzz_move_angles.inputSchema.properties.tuple.additionalItems must be a JSON Schema object or boolean",
      "fuzz_move_angles.inputSchema.anyOf must be a schema array",
      "fuzz_move_angles.inputSchema.items must be a JSON Schema object or boolean",
      "fuzz_move_angles.inputSchema.required[0] must be a string",
    ]);
  });

  it("reports dynamic JSON Schema keywords", () => {
    expect(
      projectRuntimeToolInputSchema({
        type: "object",
        anyOf: [{ $dynamicAnchor: "root" }],
        properties: {
          target: { $dynamicRef: "#target" },
        },
      }),
    ).toEqual({
      schema: {
        type: "object",
        anyOf: [{ $dynamicAnchor: "root" }],
        properties: {
          target: { $dynamicRef: "#target" },
        },
      },
      violations: [
        "parameters.anyOf[0].$dynamicAnchor",
        "parameters.properties.target.$dynamicRef",
      ],
    });
  });

  it("does not report schema map field names as dynamic JSON Schema keywords", () => {
    expect(
      projectRuntimeToolInputSchema({
        type: "object",
        $defs: {
          $dynamicAnchor: { type: "string" },
        },
        properties: {
          $dynamicRef: { type: "string" },
        },
      }).violations,
    ).toEqual([]);
  });

  it("filters unsupported schemas without dropping healthy tools", () => {
    const healthy = {
      name: "healthy",
      parameters: { type: "object", properties: {} },
    };
    const broken = {
      name: "fuzz_move_angles",
      parameters: { type: "array", items: { type: "number" } },
    };

    expect(filterRuntimeCompatibleTools([healthy, broken])).toEqual({
      tools: [healthy],
      diagnostics: [
        {
          toolName: "fuzz_move_angles",
          toolIndex: 1,
          violations: ['fuzz_move_angles.parameters.type must be "object"'],
        },
      ],
    });
  });
});

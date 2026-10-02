import { describe, expect, it } from "bun:test";
import { executeDocExtractOp, fallbackLocalExtract } from "./doc-extract.ts";

describe("doc_extract tool", () => {
  it("fails when schema is missing", () => {
    const res = executeDocExtractOp({ text: "Hello world" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Missing schema");
  });

  it("extracts structured fields via fallback schema parser", () => {
    const text = `
    Invoice Number: INV-98765
    Total Amount: 420.50
    Paid: true
    Customer: Roger
    `;

    const schema = {
      "Invoice Number": "string",
      "Total Amount": "number",
      "Paid": "boolean",
      "Customer": "string",
    };

    const res = executeDocExtractOp({ text, schema });
    expect(res.success).toBe(true);
    expect(res.backend).toBe("local_schema_parse");
    expect(res.data).toBeDefined();
    expect(res.data["Invoice Number"]).toBe("INV-98765");
    expect(res.data["Total Amount"]).toBe(420.5);
    expect(res.data["Paid"]).toBe(true);
    expect(res.data["Customer"]).toBe("Roger");
  });
});

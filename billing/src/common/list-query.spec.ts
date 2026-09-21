import { escapeRegex, mongoSort } from "./list-query";

describe("list query", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("INV-0001")).toBe("INV-0001");
    expect(escapeRegex("a+b")).toBe("a\\+b");
  });

  it("maps allowed sort keys and defaults to newest first", () => {
    expect(mongoSort({ name: "name", price: "salePrice" })).toEqual({ createdAt: -1 });
    expect(mongoSort({ name: "name" }, "name", "asc")).toEqual({ name: 1, createdAt: -1 });
    expect(mongoSort({ name: "name" }, "nope", "desc")).toEqual({ createdAt: -1 });
  });
});

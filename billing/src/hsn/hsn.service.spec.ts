import { ConflictException } from "@nestjs/common";
import { HsnService, rankHits } from "./hsn.service";

function chain(result: unknown) {
  const exec = jest.fn().mockResolvedValue(result);
  const lean = jest.fn().mockReturnValue({ exec });
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ sort });
  const find = jest.fn().mockReturnValue({ select });
  const countDocuments = jest.fn().mockResolvedValue(1);
  return { find, select, sort, limit, lean, exec, countDocuments };
}

describe("HsnService", () => {
  it("returns nothing for a short query", async () => {
    const model = { find: jest.fn() };
    const service = new HsnService(model as never);
    await expect(service.search("a")).resolves.toEqual({ items: [] });
    expect(model.find).not.toHaveBeenCalled();
  });

  it("searches by code prefix when the query looks like HSN", async () => {
    const rows = [{ code: "482010", type: "goods", description: "NOTEBOOKS", gstRate: 18 }];
    const model = chain(rows);
    const service = new HsnService(model as never);
    const out = await service.search("4820", "goods");
    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "goods",
        code: expect.any(RegExp),
      }),
    );
    expect(out.items[0]).toEqual({
      code: "482010",
      type: "goods",
      description: "NOTEBOOKS",
      gstRate: 18,
    });
  });

  it("searches descriptions for a name query", async () => {
    const model = chain([]);
    const service = new HsnService(model as never);
    await service.search("notebook");
    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        searchKey: expect.any(RegExp),
      }),
    );
  });

  it("ranks a name match above a weaker chapter note", () => {
    const ranked = rankHits(
      [
        { code: "091091", type: "goods", description: "MIXTURES REFERRED TO IN NOTE 1", gstRate: 5 },
        { code: "482010", type: "goods", description: "REGISTERS, ACCOUNT BOOKS, NOTE BOOKS", gstRate: 18 },
        { code: "48", type: "goods", description: "PAPER AND NOTE BOOKS", gstRate: 18 },
      ],
      "notebook",
    );
    expect(ranked[0].code).toBe("482010");
  });

  it("saves a missing HSN/SAC for later search", async () => {
    const created = { code: "998899", type: "service", description: "Custom IT job", gstRate: 18 };
    const model = {
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };
    const service = new HsnService(model as never);
    const out = await service.create({
      code: "998899",
      description: "Custom IT job",
      type: "service",
      gstRate: 18,
    });
    expect(out.code).toBe("998899");
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: "998899", source: "user", catalogVersion: "user" }),
    );
  });

  it("rejects a code that is already in the catalog", async () => {
    const service = new HsnService({
      exists: jest.fn().mockResolvedValue({ _id: "x" }),
      create: jest.fn(),
    } as never);
    await expect(
      service.create({ code: "482010", description: "Notebooks", type: "goods", gstRate: 18 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

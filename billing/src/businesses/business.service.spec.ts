import { ForbiddenException } from "@nestjs/common";
import { Types } from "mongoose";
import { BusinessService } from "./business.service";

function user() {
  return { id: new Types.ObjectId().toHexString(), mobile: "9717360112", status: "active" as const };
}

describe("BusinessService", () => {
  it("refuses profile updates before onboarding", async () => {
    const service = new BusinessService({ findOne: jest.fn().mockResolvedValue(null) } as never);
    await expect(service.get(user())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("saves address fields and reports profile progress", async () => {
    const row = {
      _id: new Types.ObjectId(),
      name: "Hawkey",
      mobile: "9717360112",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BusinessService({ findOne: jest.fn().mockResolvedValue(row) } as never);
    const out = await service.update(user(), {
      name: "Hawkey Traders",
      email: "shop@hawkey.in",
      address: "12 MG Road",
      city: "New Delhi",
      stateCode: "07",
      pincode: "110001",
    });
    expect(row.name).toBe("Hawkey Traders");
    expect(row.save).toHaveBeenCalled();
    expect(out.profile.percent).toBe(60);
    expect(out.profile.complete).toBe(false);
    expect(out.state).toBe("Delhi");
  });
});

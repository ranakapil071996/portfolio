import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Model, Types } from "mongoose";
import type { AuthUser } from "../auth/auth.types";
import { normalizeGstin } from "../common/gstin";
import { stateName } from "../common/indian-states";
import { profileStatus, type ProfileStatus } from "../common/profile-completion";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { Business, BusinessDocument } from "./schemas/business.schema";

export type BusinessPayload = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  stateCode: string | null;
  state: string | null;
  pincode: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  hasLogo: boolean;
  hasSignature: boolean;
  hasQr: boolean;
  logoUrl: string | null;
  signatureUrl: string | null;
  qrUrl: string | null;
  profile: ProfileStatus;
};

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

@Injectable()
export class BusinessService {
  constructor(@InjectModel(Business.name) private readonly businesses: Model<BusinessDocument>) {}

  async get(user: AuthUser): Promise<BusinessPayload> {
    const business = await this.requireBusiness(user);
    return this.toPayload(business);
  }

  async update(user: AuthUser, dto: UpdateBusinessDto): Promise<BusinessPayload> {
    const business = await this.requireBusiness(user);
    const gstin = normalizeGstin(dto.gstin);
    const stateCode = dto.stateCode;
    business.name = dto.name.trim();
    business.email = dto.email?.trim().toLowerCase() || undefined;
    business.gstin = gstin;
    business.pan = dto.pan?.trim().toUpperCase() || undefined;
    business.address = dto.address?.trim() || undefined;
    business.city = dto.city?.trim() || undefined;
    business.stateCode = stateCode;
    business.state = stateName(stateCode);
    business.pincode = dto.pincode;
    business.bankName = dto.bankName?.trim() || undefined;
    business.bankAccountName = dto.bankAccountName?.trim() || undefined;
    business.bankAccountNumber = dto.bankAccountNumber || undefined;
    business.bankIfsc = dto.bankIfsc?.trim().toUpperCase() || undefined;
    business.upiId = dto.upiId?.trim().toLowerCase() || undefined;
    await business.save();
    return this.toPayload(business);
  }

  async saveAsset(
    user: AuthUser,
    kind: "logo" | "signature" | "qr",
    file?: { mimetype: string; buffer: Buffer; size: number },
  ): Promise<BusinessPayload> {
    const business = await this.requireBusiness(user);
    if (!file || !file.buffer?.length) {
      throw new BadRequestException({
        error: "file_required",
        message: "Choose a PNG, JPG, or WebP image",
      });
    }
    const ext = IMAGE_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException({
        error: "file_type",
        message: "Use a PNG, JPG, or WebP image",
      });
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException({
        error: "file_too_large",
        message: "Keep the image under 2 MB",
      });
    }
    const dir = this.assetDir(String(business._id));
    await mkdir(dir, { recursive: true });
    const filename = `${kind}${ext}`;
    const dest = path.join(dir, filename);
    const previous =
      kind === "logo" ? business.logoFile : kind === "qr" ? business.qrFile : business.signatureFile;
    if (previous && previous !== filename) {
      await unlink(path.join(dir, previous)).catch(() => undefined);
    }
    await writeFile(dest, file.buffer);
    if (kind === "logo") business.logoFile = filename;
    else if (kind === "qr") business.qrFile = filename;
    else business.signatureFile = filename;
    await business.save();
    return this.toPayload(business);
  }

  async assetFile(
    user: AuthUser,
    kind: "logo" | "signature" | "qr",
  ): Promise<{ filePath: string; mime: string }> {
    const business = await this.requireBusiness(user);
    const filename =
      kind === "logo" ? business.logoFile : kind === "qr" ? business.qrFile : business.signatureFile;
    if (!filename) {
      throw new NotFoundException({
        error: `${kind}_missing`,
        message:
          kind === "logo"
            ? "No logo uploaded yet"
            : kind === "qr"
              ? "No QR uploaded yet"
              : "No signature uploaded yet",
      });
    }
    return {
      filePath: path.join(this.assetDir(String(business._id)), filename),
      mime: mimeFromName(filename),
    };
  }

  private async requireBusiness(user: AuthUser) {
    const business = await this.businesses.findOne({ userId: new Types.ObjectId(user.id) });
    if (!business) {
      throw new ForbiddenException({
        error: "onboarding_required",
        message: "Finish business setup first",
      });
    }
    return business;
  }

  private assetDir(businessId: string): string {
    return path.join(process.cwd(), "uploads", businessId);
  }

  private toPayload(row: BusinessDocument): BusinessPayload {
    const hasLogo = Boolean(row.logoFile);
    const hasSignature = Boolean(row.signatureFile);
    const hasQr = Boolean(row.qrFile);
    return {
      id: String(row._id),
      name: row.name,
      mobile: row.mobile,
      email: row.email || null,
      gstin: row.gstin || null,
      pan: row.pan || null,
      address: row.address || null,
      city: row.city || null,
      stateCode: row.stateCode || null,
      state: row.state || null,
      pincode: row.pincode || null,
      bankName: row.bankName || null,
      bankAccountName: row.bankAccountName || null,
      bankAccountNumber: row.bankAccountNumber || null,
      bankIfsc: row.bankIfsc || null,
      upiId: row.upiId || null,
      hasLogo,
      hasSignature,
      hasQr,
      logoUrl: hasLogo ? "/business/logo" : null,
      signatureUrl: hasSignature ? "/business/signature" : null,
      qrUrl: hasQr ? "/business/qr" : null,
      profile: profileStatus(row),
    };
  }
}

function mimeFromName(filename: string): string {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

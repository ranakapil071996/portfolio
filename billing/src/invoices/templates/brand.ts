import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BusinessDocument } from "../../businesses/schemas/business.schema";

export type InvoiceBrand = {
  logo?: Buffer;
  signature?: Buffer;
  qr?: Buffer;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  upiId?: string;
  email?: string;
  pan?: string;
};

async function readImage(dir: string, file?: string): Promise<Buffer | undefined> {
  if (!file) return undefined;
  try {
    return await readFile(path.join(dir, file));
  } catch {
    return undefined;
  }
}

export async function loadBrandAssets(business: BusinessDocument): Promise<InvoiceBrand> {
  const dir = path.join(process.cwd(), "uploads", String(business._id));
  return {
    logo: await readImage(dir, business.logoFile),
    signature: await readImage(dir, business.signatureFile),
    qr: await readImage(dir, business.qrFile),
    bankName: business.bankName,
    bankAccountName: business.bankAccountName,
    bankAccountNumber: business.bankAccountNumber,
    bankIfsc: business.bankIfsc,
    upiId: business.upiId,
    email: business.email,
    pan: business.pan,
  };
}

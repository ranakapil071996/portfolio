export type ProfileFieldId =
  | "name"
  | "email"
  | "address"
  | "logo"
  | "signature"
  | "qr"
  | "gstin"
  | "pan"
  | "bank";

export type ProfileField = {
  id: ProfileFieldId;
  core: boolean;
  label: string;
  filled: boolean;
};

export type ProfileStatus = {
  percent: number;
  complete: boolean;
  filled: number;
  total: number;
  missing: string[];
  fields: ProfileField[];
};

export type ProfileInput = {
  name?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
  logoFile?: string | null;
  signatureFile?: string | null;
  qrFile?: string | null;
  gstin?: string | null;
  pan?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
};

function hasText(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

export function profileStatus(input: ProfileInput): ProfileStatus {
  const fields: ProfileField[] = [
    { id: "name", core: true, label: "Business name", filled: hasText(input.name) },
    { id: "email", core: true, label: "Email", filled: hasText(input.email) },
    {
      id: "address",
      core: true,
      label: "Business address",
      filled:
        hasText(input.address) &&
        hasText(input.city) &&
        hasText(input.stateCode) &&
        hasText(input.pincode),
    },
    { id: "logo", core: true, label: "Business logo", filled: hasText(input.logoFile) },
    { id: "signature", core: true, label: "Signature", filled: hasText(input.signatureFile) },
    { id: "qr", core: false, label: "Payment QR", filled: hasText(input.qrFile) },
    { id: "gstin", core: false, label: "GSTIN", filled: hasText(input.gstin) },
    { id: "pan", core: false, label: "PAN", filled: hasText(input.pan) },
    {
      id: "bank",
      core: false,
      label: "Bank details",
      filled: hasText(input.bankName) && hasText(input.bankAccountNumber) && hasText(input.bankIfsc),
    },
  ];
  const core = fields.filter((field) => field.core);
  const filled = core.filter((field) => field.filled).length;
  const total = core.length;
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100);
  return {
    percent,
    complete: filled === total,
    filled,
    total,
    missing: core.filter((field) => !field.filled).map((field) => field.label),
    fields,
  };
}

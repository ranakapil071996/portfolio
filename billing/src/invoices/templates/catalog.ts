export const INVOICE_TEMPLATES = ["classic", "modern", "minimal", "thermal"] as const;
export const INVOICE_PRINTERS = ["a4", "a5", "thermal80", "thermal58"] as const;

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATES)[number];
export type InvoicePrinterId = (typeof INVOICE_PRINTERS)[number];

export type InvoiceTemplateInfo = {
  id: InvoiceTemplateId;
  name: string;
  description: string;
  printers: InvoicePrinterId[];
  defaultPrinter: InvoicePrinterId;
};

export type InvoicePrinterInfo = {
  id: InvoicePrinterId;
  name: string;
  description: string;
  widthMm: number;
  kind: "page" | "roll";
};

export type PrintChoice = {
  template: InvoiceTemplateId;
  printer: InvoicePrinterId;
};

export const INVOICE_TEMPLATE_CATALOG: InvoiceTemplateInfo[] = [
  {
    id: "classic",
    name: "Classic GST",
    description: "Full tax invoice with HSN, bank details, logo, QR, and signature",
    printers: ["a4", "a5"],
    defaultPrinter: "a4",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Bold header, logo-forward layout for laser and inkjet printers",
    printers: ["a4", "a5"],
    defaultPrinter: "a4",
  },
  {
    id: "minimal",
    name: "Compact",
    description: "Dense retail bill — works on A4/A5 and 80 mm rolls",
    printers: ["a4", "a5", "thermal80"],
    defaultPrinter: "a5",
  },
  {
    id: "thermal",
    name: "Receipt",
    description: "Centered POS receipt for 80 mm and 58 mm thermal printers",
    printers: ["thermal80", "thermal58"],
    defaultPrinter: "thermal80",
  },
];

export const INVOICE_PRINTER_CATALOG: InvoicePrinterInfo[] = [
  {
    id: "a4",
    name: "A4",
    description: "210 × 297 mm laser / inkjet",
    widthMm: 210,
    kind: "page",
  },
  {
    id: "a5",
    name: "A5",
    description: "148 × 210 mm half-page",
    widthMm: 148,
    kind: "page",
  },
  {
    id: "thermal80",
    name: "80 mm",
    description: "80 mm thermal roll (POS)",
    widthMm: 80,
    kind: "roll",
  },
  {
    id: "thermal58",
    name: "58 mm",
    description: "58 mm thermal roll (compact POS)",
    widthMm: 58,
    kind: "roll",
  },
];

const TEMPLATE_SET = new Set<string>(INVOICE_TEMPLATES);
const PRINTER_SET = new Set<string>(INVOICE_PRINTERS);
const TEMPLATE_BY_ID = new Map(INVOICE_TEMPLATE_CATALOG.map((row) => [row.id, row]));

export function isInvoiceTemplate(value: unknown): value is InvoiceTemplateId {
  return typeof value === "string" && TEMPLATE_SET.has(value);
}

export function isInvoicePrinter(value: unknown): value is InvoicePrinterId {
  return typeof value === "string" && PRINTER_SET.has(value);
}

export function resolvePrint(templateRaw?: string | null, printerRaw?: string | null): PrintChoice {
  const template = isInvoiceTemplate(templateRaw) ? templateRaw : "classic";
  const info = TEMPLATE_BY_ID.get(template)!;
  if (isInvoicePrinter(printerRaw) && info.printers.includes(printerRaw)) {
    return { template, printer: printerRaw };
  }
  return { template, printer: info.defaultPrinter };
}

export function catalogPayload() {
  return {
    templates: INVOICE_TEMPLATE_CATALOG,
    printers: INVOICE_PRINTER_CATALOG,
  };
}

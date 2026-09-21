import PDFDocument from "pdfkit";
import { paymentLine } from "../invoice-payment";
import type { InvoicePayload } from "../invoices.service";
import type { InvoiceBrand } from "./brand";
import type { InvoicePrinterId, PrintChoice } from "./catalog";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function mm(n: number): number {
  return (n * 72) / 25.4;
}

export function money(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

function chunk(n: number, scale: string): string {
  if (!n) return "";
  if (n > 99) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowHundred(n % 100)}` : ""} ${scale}`;
  return `${belowHundred(n)} ${scale}`;
}

export function amountInWords(value: number): string {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  if (!rupees && !paise) return "Zero Rupees Only";
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  const parts = [
    chunk(crore, "Crore"),
    chunk(lakh, "Lakh"),
    chunk(thousand, "Thousand"),
    rest ? (rest > 99 ? chunk(rest, "").trim() : belowHundred(rest)) : "",
  ].filter(Boolean);
  let out = parts.join(" ").replace(/\s+/g, " ").trim();
  out = out ? `${out} ${rupees === 1 ? "Rupee" : "Rupees"}` : "Zero Rupees";
  if (paise) out += ` and ${belowHundred(paise)} ${paise === 1 ? "Paisa" : "Paise"}`;
  return `${out} Only`;
}

function partyLines(p: InvoicePayload["seller"] | InvoicePayload["customer"]): string[] {
  const lines = [p.name];
  if (p.gstin) lines.push(`GSTIN ${p.gstin}`);
  if (p.mobile) lines.push(`+91 ${p.mobile}`);
  if (p.address) lines.push(p.address);
  const place = [p.city, p.state, p.pincode].filter(Boolean).join(", ");
  if (place) lines.push(place);
  return lines;
}

function hasBank(brand: InvoiceBrand): boolean {
  return Boolean(brand.bankName || brand.bankAccountNumber || brand.bankIfsc || brand.upiId);
}

function bankLines(brand: InvoiceBrand): string[] {
  const lines: string[] = [];
  if (brand.bankName) lines.push(brand.bankName);
  if (brand.bankAccountName) lines.push(brand.bankAccountName);
  if (brand.bankAccountNumber) lines.push(`A/C ${brand.bankAccountNumber}`);
  if (brand.bankIfsc) lines.push(`IFSC ${brand.bankIfsc}`);
  if (brand.upiId) lines.push(`UPI ${brand.upiId}`);
  return lines;
}

function taxLabel(inv: InvoicePayload): string {
  return inv.taxSplit === "igst" ? "IGST" : "CGST + SGST";
}

function estimateReceiptHeight(
  inv: InvoicePayload,
  brand: InvoiceBrand,
  narrow: boolean,
  pageWidth: number,
  margin: number,
): number {
  const width = pageWidth - margin * 2;
  let y = margin;
  const logo = Math.min(narrow ? 36 : 48, width * 0.4);
  if (brand.logo) y += logo + 4;
  y += narrow ? 14 : 16;
  const head = [
    inv.seller.gstin,
    inv.seller.mobile,
    inv.seller.address,
    [inv.seller.city, inv.seller.pincode].filter(Boolean).join(" "),
  ].filter(Boolean);
  y += head.length * 9;
  y += 7 + 11 + 11 + 10;
  if (inv.customer.mobile) y += 10;
  if (inv.placeOfSupply) y += 10;
  y += 7;
  const chars = Math.max(10, Math.floor(width / 4.2));
  for (const line of inv.lines) {
    y += Math.max(10, Math.ceil(String(line.name || "").length / chars) * 10);
    y += 11;
  }
  y += 7;
  y += 11 + (inv.taxSplit === "igst" ? 11 : 22) + (inv.cessTotal ? 11 : 0) + 13;
  y += 7;
  if (inv.notes) y += 18 + Math.ceil(inv.notes.length / Math.max(12, chars)) * 9;
  if (brand.qr) y += Math.min(narrow ? 68 : 80, width * 0.7) + 16;
  else if (brand.upiId) y += 12;
  if (brand.signature) y += 34;
  y += 18 + margin + 24;
  return Math.max(mm(160), y);
}

function pageSpec(
  printer: InvoicePrinterId,
  inv: InvoicePayload,
  brand: InvoiceBrand,
  template: PrintChoice["template"] = "classic",
): { size: "A4" | "A5" | [number, number]; margin: number } {
  if (printer === "a4") return { size: "A4", margin: 40 };
  if (printer === "a5") return { size: "A5", margin: 28 };
  const margin = printer === "thermal58" ? 8 : 10;
  const width = mm(printer === "thermal58" ? 58 : 80);
  let height = estimateReceiptHeight(inv, brand, printer === "thermal58", width, margin);
  if (template === "minimal") height += 110;
  return { size: [width, height], margin };
}

class Painter {
  readonly doc: PDFKit.PDFDocument;
  readonly left: number;
  readonly width: number;
  readonly bottom: number;
  y: number;

  constructor(doc: PDFKit.PDFDocument) {
    this.doc = doc;
    this.left = doc.page.margins.left;
    this.width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    this.bottom = doc.page.height - doc.page.margins.bottom;
    this.y = doc.page.margins.top;
  }

  ensure(space: number): void {
    if (this.y + space <= this.bottom) return;
    this.doc.addPage();
    this.y = this.doc.page.margins.top;
  }

  image(buffer: Buffer | undefined, x: number, y: number, opts: PDFKit.Mixins.ImageOption): number {
    if (!buffer) return 0;
    try {
      this.doc.image(buffer, x, y, opts);
      if (opts.fit) return opts.fit[1];
      if (opts.height) return Number(opts.height);
      if (opts.width) return Number(opts.width);
      return 48;
    } catch {
      return 0;
    }
  }

  containImage(buffer: Buffer | undefined, x: number, y: number, w: number, h: number): number {
    if (!buffer) return 0;
    try {
      this.doc.image(buffer, x, y, { fit: [w, h], align: "center", valign: "center" });
      return h;
    } catch {
      return 0;
    }
  }

  fillRound(x: number, y: number, w: number, h: number, r: number, fill: string): void {
    this.doc.save();
    this.doc.roundedRect(x, y, w, h, r).fillColor(fill).fill();
    this.doc.restore();
  }

  roundedImage(
    buffer: Buffer | undefined,
    x: number,
    y: number,
    size: number,
    radius = 8,
  ): number {
    if (!buffer) return 0;
    try {
      this.doc.save();
      this.doc.roundedRect(x, y, size, size, radius).clip();
      this.doc.image(buffer, x, y, { fit: [size, size], align: "center", valign: "center" });
      this.doc.restore();
      this.doc
        .roundedRect(x, y, size, size, radius)
        .lineWidth(0.7)
        .strokeColor("#e2e8f0")
        .stroke();
      return size;
    } catch {
      return 0;
    }
  }

  rule(color = "#cbd5e1"): void {
    this.doc
      .moveTo(this.left, this.y)
      .lineTo(this.left + this.width, this.y)
      .strokeColor(color)
      .lineWidth(0.6)
      .stroke();
    this.y += 8;
  }

  dash(): void {
    this.doc
      .save()
      .moveTo(this.left, this.y)
      .lineTo(this.left + this.width, this.y)
      .dash(2, { space: 2 })
      .strokeColor("#94a3b8")
      .lineWidth(0.5)
      .stroke()
      .restore();
    this.y += 7;
  }
}

function paintTaxRows(p: Painter, inv: InvoicePayload, boxW: number, compact = false): void {
  const boxX = p.left + p.width - boxW;
  const addRow = (label: string, value: string, bold = false) => {
    p.ensure(14);
    p.doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(compact ? 8 : 9).fillColor("#0f172a");
    p.doc.text(label, boxX, p.y, { width: boxW * 0.42 });
    p.doc.text(value, boxX + boxW * 0.42, p.y, { width: boxW * 0.58, align: "right" });
    p.y += compact ? 12 : 14;
  };
  addRow("Taxable", money(inv.taxableTotal));
  if (inv.taxSplit === "igst") addRow("IGST", money(inv.igstTotal));
  else {
    addRow("CGST", money(inv.cgstTotal));
    addRow("SGST", money(inv.sgstTotal));
  }
  if (inv.cessTotal) addRow("Cess", money(inv.cessTotal));
  p.doc
    .moveTo(boxX, p.y)
    .lineTo(boxX + boxW, p.y)
    .strokeColor("#94a3b8")
    .stroke();
  p.y += 6;
  addRow("Total", money(inv.grandTotal), true);
}

function paintNotes(p: Painter, inv: InvoicePayload): void {
  const line = paymentLine(inv);
  const paid = inv.paid === true || inv.status === "paid";
  p.y += 8;
  p.ensure(16);
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor(paid ? "#047857" : "#b45309").text(line, p.left, p.y);
  p.y += 12;
  if (!inv.notes) return;
  p.ensure(20);
  p.doc.font("Helvetica").fontSize(8).fillColor("#334155").text(inv.notes, p.left, p.y, { width: p.width });
  p.y += p.doc.heightOfString(inv.notes, { width: p.width }) + 4;
}

function paintBrandFooter(p: Painter, brand: InvoiceBrand, wide: boolean): void {
  const slots = (hasBank(brand) ? 1 : 0) + (brand.qr ? 1 : 0) + 1;
  const cols = wide ? Math.max(slots, 2) : Math.min(2, slots);
  const gap = 10;
  const colW = (p.width - gap * (cols - 1)) / cols;
  const startY = p.y + 10;
  let col = 0;
  let rowY = startY;
  let tallest = 0;

  const cellX = () => p.left + (col % cols) * (colW + gap);
  const advance = (h: number) => {
    tallest = Math.max(tallest, h);
    col += 1;
    if (col % cols === 0) {
      rowY += tallest + 10;
      tallest = 0;
    }
  };

  if (hasBank(brand)) {
    p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text("Bank details", cellX(), rowY, {
      width: colW,
      lineBreak: false,
    });
    p.doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
    const text = bankLines(brand).join("\n");
    p.doc.text(text, cellX(), rowY + 12, { width: colW });
    advance(12 + p.doc.heightOfString(text, { width: colW }));
  }

  if (brand.qr) {
    p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text("Pay by QR", cellX(), rowY, {
      width: colW,
      align: "center",
      lineBreak: false,
    });
    const qrSize = Math.min(72, colW);
    p.image(brand.qr, cellX() + (colW - qrSize) / 2, rowY + 12, { fit: [qrSize, qrSize] });
    if (brand.upiId) {
      p.doc.font("Helvetica").fontSize(7).fillColor("#334155").text(brand.upiId, cellX(), rowY + 12 + qrSize + 2, {
        width: colW,
        align: "center",
      });
    }
    advance(12 + qrSize + (brand.upiId ? 12 : 0));
  }

  p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text("Authorised signatory", cellX(), rowY, {
    width: colW,
    align: "center",
    lineBreak: false,
  });
  const signW = Math.min(110, colW);
  const signH = 36;
  if (brand.signature) {
    p.containImage(brand.signature, cellX() + (colW - signW) / 2, rowY + 12, signW, signH);
    advance(12 + signH + 4);
  } else {
    const lineX = cellX() + (colW - Math.min(110, colW)) / 2;
    p.doc
      .moveTo(lineX, rowY + 40)
      .lineTo(lineX + Math.min(110, colW), rowY + 40)
      .strokeColor("#cbd5e1")
      .stroke();
    advance(46);
  }

  p.y = rowY + (col % cols === 0 ? 0 : tallest) + 10;
  p.doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#94a3b8")
    .text("This is a computer generated invoice.", p.left, p.y, { width: p.width, align: "center" });
  p.y += 12;
}

function paintClassic(p: Painter, inv: InvoicePayload, brand: InvoiceBrand, compact: boolean): void {
  const logo = 56;
  const top = p.y;
  const used = p.roundedImage(brand.logo, p.left, p.y, logo, 8);
  const textX = p.left + (used ? logo + 10 : 0);
  const midW = Math.max(80, p.width - (used ? logo + 10 : 0) - 92);
  const metaX = p.left + p.width - 90;
  p.doc.font("Helvetica-Bold").fontSize(compact ? 11 : 13).fillColor("#0f172a").text(inv.seller.name, textX, top, {
    width: midW,
  });
  p.doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text("TAX INVOICE", metaX, top, {
    width: 90,
    align: "right",
    lineBreak: false,
  });
  p.doc.font("Helvetica").fontSize(8).fillColor("#475569");
  p.doc.text(inv.invoiceNumber, metaX, top + 13, { width: 90, align: "right", lineBreak: false });
  p.doc.text(inv.invoiceDate, metaX, top + 24, { width: 90, align: "right", lineBreak: false });
  let detailY = top + 14;
  [
    inv.seller.gstin ? `GSTIN ${inv.seller.gstin}` : "",
    inv.seller.mobile ? `+91 ${inv.seller.mobile}` : "",
    inv.seller.address || "",
  ]
    .filter(Boolean)
    .forEach((line) => {
      p.doc.font("Helvetica").fontSize(8).fillColor("#475569").text(line, textX, detailY, { width: midW });
      detailY += 11;
    });
  p.y = Math.max(top + (used || 56), top + 38, detailY) + 10;

  const col = p.width / 2 - 8;
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("FROM", p.left, p.y);
  p.doc.text("BILL TO", p.left + p.width / 2, p.y);
  p.y += 12;
  p.doc.font("Helvetica").fontSize(compact ? 8 : 9).fillColor("#0f172a");
  const seller = partyLines(inv.seller);
  const buyer = partyLines(inv.customer);
  const rows = Math.max(seller.length, buyer.length);
  for (let i = 0; i < rows; i += 1) {
    p.ensure(12);
    if (seller[i]) p.doc.text(seller[i], p.left, p.y, { width: col });
    if (buyer[i]) p.doc.text(buyer[i], p.left + p.width / 2, p.y, { width: col });
    p.y += compact ? 11 : 12;
  }
  p.y += 4;
  p.doc.font("Helvetica").fontSize(8).fillColor("#475569");
  p.doc.text(`Place of supply: ${inv.placeOfSupply || "—"}   ·   Tax: ${taxLabel(inv)}`, p.left, p.y, {
    width: p.width,
  });
  p.y += 16;

  const pad = 6;
  const inner = p.width - pad * 2;
  const cols = compact
    ? [
        { label: "Item", w: inner - 216, align: "left" as const },
        { label: "Qty", w: 44, align: "right" as const },
        { label: "Rate", w: 64, align: "right" as const },
        { label: "GST", w: 32, align: "right" as const },
        { label: "Amount", w: 76, align: "right" as const },
      ]
    : [
        { label: "Item", w: inner - 272, align: "left" as const },
        { label: "HSN", w: 56, align: "left" as const },
        { label: "Qty", w: 44, align: "right" as const },
        { label: "Rate", w: 64, align: "right" as const },
        { label: "GST", w: 32, align: "right" as const },
        { label: "Amount", w: 76, align: "right" as const },
      ];

  p.ensure(24);
  p.doc.rect(p.left, p.y, p.width, 18).fill("#e2e8f0");
  p.doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#334155");
  let x = p.left + pad;
  cols.forEach((colDef) => {
    p.doc.text(colDef.label, x, p.y + 5, { width: colDef.w, align: colDef.align });
    x += colDef.w;
  });
  p.y += 20;

  p.doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
  inv.lines.forEach((line, index) => {
    const cells = compact
      ? [
          line.name + (line.source === "charge" ? " (charge)" : ""),
          `${line.qty} ${line.unit}`,
          money(line.rate),
          `${line.gstRate}%`,
          money(line.lineTotal),
        ]
      : [
          line.name + (line.source === "charge" ? " (charge)" : ""),
          line.hsnSac || "—",
          `${line.qty} ${line.unit}`,
          money(line.rate),
          `${line.gstRate}%`,
          money(line.lineTotal),
        ];
    let rowH = 14;
    cols.forEach((colDef, i) => {
      const h = p.doc.heightOfString(cells[i], { width: colDef.w });
      if (h + 6 > rowH) rowH = h + 6;
    });
    p.ensure(rowH + 4);
    x = p.left + pad;
    cols.forEach((colDef, i) => {
      p.doc.text(cells[i], x, p.y + 2, { width: colDef.w, align: colDef.align });
      x += colDef.w;
    });
    p.y += rowH;
    p.doc
      .moveTo(p.left, p.y)
      .lineTo(p.left + p.width, p.y)
      .strokeColor("#e2e8f0")
      .stroke();
    p.y += 3;
  });

  p.y += 8;
  paintTaxRows(p, inv, compact ? 170 : 210, compact);
  p.y += 6;
  p.ensure(20);
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("Amount in words  ", p.left, p.y, {
    continued: true,
  });
  p.doc.font("Helvetica").fontSize(8).fillColor("#0f172a").text(amountInWords(inv.grandTotal), {
    width: p.width,
  });
  p.y += p.doc.heightOfString(`Amount in words  ${amountInWords(inv.grandTotal)}`, { width: p.width }) + 4;
  paintNotes(p, inv);
  p.ensure(90);
  paintBrandFooter(p, brand, !compact);
}

function paintModern(p: Painter, inv: InvoicePayload, brand: InvoiceBrand, compact: boolean): void {
  const headerH = compact ? 58 : 72;
  p.fillRound(p.left - 4, p.y - 4, p.width + 8, headerH, 10, "#0f172a");
  const mark = compact ? 40 : 52;
  const logo = p.roundedImage(brand.logo, p.left + 6, p.y + 4, mark, 8);
  const textX = p.left + (logo ? (compact ? 54 : 68) : 8);
  p.doc.font("Helvetica-Bold").fontSize(compact ? 11 : 15).fillColor("#ffffff").text(inv.seller.name, textX, p.y + 6, {
    width: p.width * 0.55,
  });
  p.doc.font("Helvetica").fontSize(8).fillColor("#cbd5e1");
  if (inv.seller.gstin) {
    p.doc.text(`GSTIN ${inv.seller.gstin}`, textX, p.y + (compact ? 22 : 26), { width: p.width * 0.55 });
  }
  p.doc.font("Helvetica-Bold").fontSize(compact ? 10 : 12).fillColor("#ffffff").text("TAX INVOICE", p.left, p.y + 8, {
    width: p.width - 10,
    align: "right",
  });
  p.doc.font("Helvetica").fontSize(8).fillColor("#e2e8f0");
  p.doc.text(`${inv.invoiceNumber}\n${inv.invoiceDate}`, p.left, p.y + (compact ? 24 : 28), {
    width: p.width - 10,
    align: "right",
  });
  p.y += headerH + 8;

  const col = p.width / 2 - 8;
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f766e").text("FROM", p.left, p.y);
  p.doc.text("BILL TO", p.left + p.width / 2, p.y);
  p.y += 12;
  p.doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
  const seller = partyLines(inv.seller);
  const buyer = partyLines(inv.customer);
  const rows = Math.max(seller.length, buyer.length);
  for (let i = 0; i < rows; i += 1) {
    p.ensure(12);
    if (seller[i]) p.doc.text(seller[i], p.left, p.y, { width: col });
    if (buyer[i]) p.doc.text(buyer[i], p.left + p.width / 2, p.y, { width: col });
    p.y += 11;
  }
  p.y += 6;
  p.doc.font("Helvetica").fontSize(8).fillColor("#0f766e");
  p.doc.text(`Place of supply  ${inv.placeOfSupply || "—"}   ·   ${taxLabel(inv)}`, p.left, p.y, { width: p.width });
  p.y += 14;

  p.ensure(22);
  p.doc.rect(p.left, p.y, p.width, 18).fill("#0f766e");
  const pad = 6;
  const inner = p.width - pad * 2;
  const cols = compact
    ? [
        { label: "Item", w: inner - 216, align: "left" as const },
        { label: "Qty", w: 44, align: "right" as const },
        { label: "Rate", w: 64, align: "right" as const },
        { label: "GST", w: 32, align: "right" as const },
        { label: "Amount", w: 76, align: "right" as const },
      ]
    : [
        { label: "Item", w: inner - 272, align: "left" as const },
        { label: "HSN", w: 56, align: "left" as const },
        { label: "Qty", w: 44, align: "right" as const },
        { label: "Rate", w: 64, align: "right" as const },
        { label: "GST", w: 32, align: "right" as const },
        { label: "Amount", w: 76, align: "right" as const },
      ];
  p.doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
  let x = p.left + pad;
  cols.forEach((colDef) => {
    p.doc.text(colDef.label, x, p.y + 5, { width: colDef.w, align: colDef.align });
    x += colDef.w;
  });
  p.y += 20;
  p.doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
  inv.lines.forEach((line, index) => {
    const cells = compact
      ? [
          line.name + (line.source === "charge" ? " (charge)" : ""),
          `${line.qty} ${line.unit}`,
          money(line.rate),
          `${line.gstRate}%`,
          money(line.lineTotal),
        ]
      : [
          line.name + (line.source === "charge" ? " (charge)" : ""),
          line.hsnSac || "—",
          `${line.qty} ${line.unit}`,
          money(line.rate),
          `${line.gstRate}%`,
          money(line.lineTotal),
        ];
    let rowH = 14;
    cols.forEach((colDef, i) => {
      const h = p.doc.heightOfString(cells[i], { width: colDef.w });
      if (h + 6 > rowH) rowH = h + 6;
    });
    p.ensure(rowH + 2);
    p.doc.fillColor("#0f172a");
    x = p.left + pad;
    cols.forEach((colDef, i) => {
      p.doc.text(cells[i], x, p.y + 2, { width: colDef.w, align: colDef.align });
      x += colDef.w;
    });
    p.y += rowH;
    p.doc
      .moveTo(p.left, p.y)
      .lineTo(p.left + p.width, p.y)
      .strokeColor("#e2e8f0")
      .stroke();
    p.y += 3;
  });
  p.y += 10;
  paintTaxRows(p, inv, compact ? 170 : 210, compact);
  p.y += 6;
  p.ensure(20);
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("Amount in words  ", p.left, p.y, {
    continued: true,
  });
  p.doc.font("Helvetica").fontSize(8).fillColor("#0f172a").text(amountInWords(inv.grandTotal), { width: p.width });
  p.y += p.doc.heightOfString(`Amount in words  ${amountInWords(inv.grandTotal)}`, { width: p.width }) + 4;
  paintNotes(p, inv);
  p.ensure(90);
  paintBrandFooter(p, brand, !compact);
}

function paintPartyBlock(p: Painter, title: string, lines: string[], x: number, width: number): number {
  const start = p.y;
  p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text(title, x, p.y, { width, lineBreak: false });
  p.doc.font("Helvetica").fontSize(7.5).fillColor("#0f172a");
  let y = start + 11;
  lines.forEach((line) => {
    p.doc.text(line, x, y, { width });
    y += Math.max(10, p.doc.heightOfString(line, { width }) + 2);
  });
  return y - start;
}

function paintRollFooter(p: Painter, brand: InvoiceBrand): void {
  p.y += 8;
  if (hasBank(brand)) {
    p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text("Bank details", p.left, p.y, {
      width: p.width,
      align: "center",
      lineBreak: false,
    });
    p.y += 11;
    p.doc.font("Helvetica").fontSize(7).fillColor("#0f172a").text(bankLines(brand).join("\n"), p.left, p.y, {
      width: p.width,
      align: "center",
    });
    p.y += p.doc.heightOfString(bankLines(brand).join("\n"), { width: p.width, align: "center" }) + 8;
  }
  if (brand.qr) {
    p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text("Pay by QR", p.left, p.y, {
      width: p.width,
      align: "center",
      lineBreak: false,
    });
    p.y += 11;
    const size = Math.min(72, p.width * 0.55);
    p.image(brand.qr, p.left + (p.width - size) / 2, p.y, { fit: [size, size] });
    p.y += size + 4;
    if (brand.upiId) {
      p.doc.font("Helvetica").fontSize(7).fillColor("#334155").text(brand.upiId, p.left, p.y, {
        width: p.width,
        align: "center",
      });
      p.y += 11;
    }
  }
  p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text("Authorised signatory", p.left, p.y, {
    width: p.width,
    align: "center",
    lineBreak: false,
  });
  p.y += 11;
  if (brand.signature) {
    const w = Math.min(110, p.width * 0.85);
    p.containImage(brand.signature, p.left + (p.width - w) / 2, p.y, w, 36);
    p.y += 40;
  } else {
    p.doc
      .moveTo(p.left + (p.width - 90) / 2, p.y + 18)
      .lineTo(p.left + (p.width - 90) / 2 + 90, p.y + 18)
      .strokeColor("#cbd5e1")
      .stroke();
    p.y += 26;
  }
  p.doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#94a3b8")
    .text("This is a computer generated invoice.", p.left, p.y, { width: p.width, align: "center" });
  p.y += 10;
}

function paintMinimal(p: Painter, inv: InvoicePayload, brand: InvoiceBrand, roll: boolean): void {
  const mark = roll ? 40 : 56;
  const top = p.y;
  const used = p.roundedImage(brand.logo, p.left, p.y, mark, 8);
  const textX = p.left + (used ? mark + 8 : 0);
  const metaW = roll ? 72 : 90;
  const midW = Math.max(64, p.width - (used ? mark + 8 : 0) - metaW);
  const metaX = p.left + p.width - metaW;
  p.doc.font("Helvetica-Bold").fontSize(roll ? 9 : 12).fillColor("#0f172a").text(inv.seller.name, textX, top, {
    width: midW,
  });
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text("TAX INVOICE", metaX, top, {
    width: metaW,
    align: "right",
    lineBreak: false,
  });
  p.doc.font("Helvetica").fontSize(7).fillColor("#475569");
  p.doc.text(inv.invoiceNumber, metaX, top + 11, { width: metaW, align: "right", lineBreak: false });
  p.doc.text(inv.invoiceDate, metaX, top + 21, { width: metaW, align: "right", lineBreak: false });
  let detailY = top + 12;
  [
    inv.seller.gstin ? `GSTIN ${inv.seller.gstin}` : "",
    inv.seller.mobile ? `+91 ${inv.seller.mobile}` : "",
    inv.seller.address || "",
  ]
    .filter(Boolean)
    .forEach((line) => {
      p.doc.font("Helvetica").fontSize(7).fillColor("#475569").text(line, textX, detailY, { width: midW });
      detailY += 10;
    });
  p.y = Math.max(top + (used || mark), top + 34, detailY) + 8;

  const seller = partyLines(inv.seller);
  const buyer = partyLines(inv.customer);
  const col = p.width / 2 - 4;
  const fromH = paintPartyBlock(p, "FROM", seller, p.left, col);
  const toH = paintPartyBlock(p, "BILL TO", buyer, p.left + p.width / 2, col);
  p.y += Math.max(fromH, toH) + 4;
  p.doc.font("Helvetica").fontSize(7).fillColor("#64748b");
  p.doc.text(`Place of supply  ${inv.placeOfSupply || "—"}  ·  ${taxLabel(inv)}`, p.left, p.y, { width: p.width });
  p.y += 12;

  const pad = 4;
  const inner = p.width - pad * 2;
  const cols = [
    { label: "Item", w: inner - 96, align: "left" as const },
    { label: "Qty", w: 32, align: "right" as const },
    { label: "Amount", w: 64, align: "right" as const },
  ];
  p.doc.rect(p.left, p.y, p.width, 16).fill("#e2e8f0");
  p.doc.font("Helvetica-Bold").fontSize(7).fillColor("#334155");
  let x = p.left + pad;
  cols.forEach((colDef) => {
    p.doc.text(colDef.label, x, p.y + 4, { width: colDef.w, align: colDef.align });
    x += colDef.w;
  });
  p.y += 18;
  p.doc.font("Helvetica").fontSize(7.5).fillColor("#0f172a");
  inv.lines.forEach((line) => {
    const name = line.name + (line.source === "charge" ? " (chg)" : "");
    const h = Math.max(11, p.doc.heightOfString(name, { width: cols[0].w }) + 2);
    p.ensure(h + 12);
    x = p.left + pad;
    p.doc.text(name, x, p.y, { width: cols[0].w });
    p.doc.text(String(line.qty), x + cols[0].w, p.y, { width: cols[1].w, align: "right" });
    p.doc.text(money(line.lineTotal), x + cols[0].w + cols[1].w, p.y, { width: cols[2].w, align: "right" });
    p.y += h;
    p.doc.font("Helvetica").fontSize(6.5).fillColor("#64748b");
    p.doc.text(`${money(line.rate)}  ·  GST ${line.gstRate}%`, p.left + pad, p.y, { width: p.width - pad * 2 });
    p.doc.font("Helvetica").fontSize(7.5).fillColor("#0f172a");
    p.y += 10;
  });
  p.rule();
  paintTaxRows(p, inv, roll ? p.width : 150, true);
  paintNotes(p, inv);
  p.ensure(roll ? 140 : 80);
  if (roll) paintRollFooter(p, brand);
  else paintBrandFooter(p, brand, false);
}

function paintThermal(p: Painter, inv: InvoicePayload, brand: InvoiceBrand, narrow: boolean): void {
  const logo = Math.min(narrow ? 36 : 48, p.width * 0.4);
  if (brand.logo) {
    p.roundedImage(brand.logo, p.left + (p.width - logo) / 2, p.y, logo, 8);
    p.y += logo + 4;
  }
  p.doc.font("Helvetica-Bold").fontSize(narrow ? 9 : 11).fillColor("#0f172a").text(inv.seller.name, p.left, p.y, {
    width: p.width,
    align: "center",
  });
  p.y += narrow ? 12 : 14;
  p.doc.font("Helvetica").fontSize(7).fillColor("#334155");
  const head = [
    inv.seller.gstin ? `GSTIN ${inv.seller.gstin}` : "",
    inv.seller.mobile ? `+91 ${inv.seller.mobile}` : "",
    inv.seller.address || "",
    [inv.seller.city, inv.seller.pincode].filter(Boolean).join(" "),
  ].filter(Boolean);
  head.forEach((line) => {
    p.doc.text(line, p.left, p.y, { width: p.width, align: "center" });
    p.y += 9;
  });
  p.dash();
  p.doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text("TAX INVOICE", p.left, p.y, {
    width: p.width,
    align: "center",
  });
  p.y += 11;
  p.doc.font("Helvetica").fontSize(7.5).fillColor("#0f172a");
  p.doc.text(inv.invoiceNumber, p.left, p.y, { width: p.width, align: "center" });
  p.y += 10;
  p.doc.text(inv.invoiceDate, p.left, p.y, { width: p.width, align: "center" });
  p.y += 11;
  p.doc.text(`Bill to: ${inv.customer.name}`, p.left, p.y, { width: p.width, align: "center" });
  p.y += 10;
  if (inv.placeOfSupply) {
    p.doc.font("Helvetica").fontSize(7).fillColor("#475569").text(`POS ${inv.placeOfSupply} · ${taxLabel(inv)}`, p.left, p.y, {
      width: p.width,
      align: "center",
    });
    p.y += 10;
  }
  p.dash();
  inv.lines.forEach((line) => {
    p.doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0f172a");
    p.doc.text(line.name, p.left, p.y, { width: p.width });
    p.y += Math.max(10, p.doc.heightOfString(line.name, { width: p.width }));
    p.doc.font("Helvetica").fontSize(7).fillColor("#334155");
    p.doc.text(`${line.qty} ${line.unit} x ${money(line.rate)}  GST ${line.gstRate}%`, p.left, p.y, {
      width: p.width * 0.62,
    });
    p.doc.text(money(line.lineTotal), p.left, p.y, { width: p.width, align: "right" });
    p.y += 11;
  });
  p.dash();
  const row = (label: string, value: string, bold = false) => {
    p.doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9 : 7.5).fillColor("#0f172a");
    p.doc.text(label, p.left, p.y, { width: p.width * 0.5 });
    p.doc.text(value, p.left, p.y, { width: p.width, align: "right" });
    p.y += bold ? 13 : 11;
  };
  row("Taxable", money(inv.taxableTotal));
  if (inv.taxSplit === "igst") row("IGST", money(inv.igstTotal));
  else {
    row("CGST", money(inv.cgstTotal));
    row("SGST", money(inv.sgstTotal));
  }
  if (inv.cessTotal) row("Cess", money(inv.cessTotal));
  row("TOTAL", money(inv.grandTotal), true);
  p.dash();
  if (inv.notes) {
    p.doc.font("Helvetica").fontSize(7).fillColor("#334155").text(inv.notes, p.left, p.y, { width: p.width });
    p.y += p.doc.heightOfString(inv.notes, { width: p.width }) + 6;
  }
  if (brand.qr) {
    const size = Math.min(72, p.width * 0.7);
    p.image(brand.qr, p.left + (p.width - size) / 2, p.y, { fit: [size, size], align: "center", valign: "center" });
    p.y += size + 4;
    if (brand.upiId) {
      p.doc.font("Helvetica").fontSize(7).fillColor("#334155").text(brand.upiId, p.left, p.y, {
        width: p.width,
        align: "center",
      });
      p.y += 11;
    }
  } else if (brand.upiId) {
    p.doc.font("Helvetica").fontSize(7).fillColor("#334155").text(brand.upiId, p.left, p.y, {
      width: p.width,
      align: "center",
    });
    p.y += 11;
  }
  if (brand.signature) {
    const w = Math.min(110, p.width * 0.85);
    p.containImage(brand.signature, p.left + (p.width - w) / 2, p.y, w, 36);
    p.y += 40;
  }
  p.doc.font("Helvetica").fontSize(7).fillColor("#64748b").text("Thank you. Visit again.", p.left, p.y, {
    width: p.width,
    align: "center",
  });
}

export function renderInvoicePdf(
  inv: InvoicePayload,
  brand: InvoiceBrand = {},
  print: PrintChoice = { template: "classic", printer: "a4" },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const spec = pageSpec(print.printer, inv, brand, print.template);
    const doc = new PDFDocument({ size: spec.size, margin: spec.margin });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const p = new Painter(doc);
    const compact = print.printer === "a5";
    if (print.template === "modern") paintModern(p, inv, brand, compact);
    else if (print.template === "minimal") paintMinimal(p, inv, brand, print.printer === "thermal80");
    else if (print.template === "thermal") paintThermal(p, inv, brand, print.printer === "thermal58");
    else paintClassic(p, inv, brand, compact);

    doc.end();
  });
}

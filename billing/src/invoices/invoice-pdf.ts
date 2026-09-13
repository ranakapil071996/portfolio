import PDFDocument from "pdfkit";
import type { InvoicePayload } from "./invoices.service";

function money(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function partyBlock(p: InvoicePayload["seller"] | InvoicePayload["customer"]): string[] {
  const lines = [p.name];
  if (p.gstin) lines.push(`GSTIN ${p.gstin}`);
  if (p.mobile) lines.push(`+91 ${p.mobile}`);
  if (p.address) lines.push(p.address);
  const place = [p.city, p.state, p.pincode].filter(Boolean).join(", ");
  if (place) lines.push(place);
  return lines;
}

export function renderInvoicePdf(inv: InvoicePayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    let y = 48;

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("TAX INVOICE", left, y);
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    doc.text(inv.invoiceNumber, left, y, { width: pageWidth, align: "right" });
    doc.text(inv.invoiceDate, left, y + 14, { width: pageWidth, align: "right" });
    y += 40;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor("#cbd5e1").stroke();
    y += 16;

    const col = pageWidth / 2 - 8;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("FROM", left, y);
    doc.text("BILL TO", left + pageWidth / 2, y);
    y += 14;
    doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
    const seller = partyBlock(inv.seller);
    const buyer = partyBlock(inv.customer);
    const rows = Math.max(seller.length, buyer.length);
    for (let i = 0; i < rows; i += 1) {
      if (seller[i]) doc.text(seller[i], left, y, { width: col });
      if (buyer[i]) doc.text(buyer[i], left + pageWidth / 2, y, { width: col });
      y += 13;
    }
    y += 8;
    const taxLabel = inv.taxSplit === "igst" ? "IGST" : "CGST + SGST";
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    doc.text(
      `Place of supply: ${inv.placeOfSupply || "—"}   ·   Tax: ${taxLabel}`,
      left,
      y,
      { width: pageWidth },
    );
    y += 20;

    const cols = [
      { key: "no", label: "#", w: 24, align: "left" as const },
      { key: "name", label: "Item", w: 188, align: "left" as const },
      { key: "hsn", label: "HSN", w: 62, align: "left" as const },
      { key: "qty", label: "Qty", w: 48, align: "right" as const },
      { key: "rate", label: "Rate", w: 72, align: "right" as const },
      { key: "gst", label: "GST", w: 40, align: "right" as const },
      { key: "amt", label: "Amount", w: 64, align: "right" as const },
    ];
    doc.rect(left, y, pageWidth, 20).fill("#e2e8f0");
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
    let x = left + 6;
    cols.forEach((colDef) => {
      doc.text(colDef.label, x, y + 6, { width: colDef.w, align: colDef.align });
      x += colDef.w;
    });
    y += 22;

    doc.font("Helvetica").fontSize(9).fillColor("#0f172a");
    inv.lines.forEach((line, index) => {
      if (y > 720) {
        doc.addPage();
        y = 48;
      }
      const cells = [
        String(index + 1),
        line.name + (line.source === "charge" ? " (charge)" : ""),
        line.hsnSac || "—",
        `${line.qty} ${line.unit}`,
        money(line.rate),
        `${line.gstRate}%`,
        money(line.lineTotal),
      ];
      x = left + 6;
      let rowH = 16;
      cols.forEach((colDef, i) => {
        const h = doc.heightOfString(cells[i], { width: colDef.w });
        if (h + 6 > rowH) rowH = h + 6;
      });
      cols.forEach((colDef, i) => {
        doc.text(cells[i], x, y + 3, { width: colDef.w, align: colDef.align });
        x += colDef.w;
      });
      y += rowH;
      doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor("#e2e8f0").stroke();
      y += 4;
    });

    y += 10;
    const boxW = 200;
    const boxX = left + pageWidth - boxW;
    const addRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#0f172a");
      doc.text(label, boxX, y, { width: 90 });
      doc.text(value, boxX + 90, y, { width: 110, align: "right" });
      y += 16;
    };
    addRow("Taxable", money(inv.taxableTotal));
    if (inv.taxSplit === "igst") addRow("IGST", money(inv.igstTotal));
    else {
      addRow("CGST", money(inv.cgstTotal));
      addRow("SGST", money(inv.sgstTotal));
    }
    if (inv.cessTotal) addRow("Cess", money(inv.cessTotal));
    doc.moveTo(boxX, y).lineTo(boxX + boxW, y).strokeColor("#94a3b8").stroke();
    y += 8;
    addRow("Total", money(inv.grandTotal), true);

    if (inv.notes) {
      y += 16;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("Notes", left, y);
      y += 13;
      doc.font("Helvetica").fontSize(9).fillColor("#334155").text(inv.notes, left, y, { width: pageWidth });
    }

    doc.end();
  });
}

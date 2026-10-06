import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { documentCompany } from "@/lib/config/documents";

export type BusinessDocument = {
  title: string;
  number: string;
  date: string;
  status?: string;
  partyLabel: string;
  party: string[];
  metadata?: string[];
  columns: { label: string; width: number; right?: boolean }[];
  rows: string[][];
  totals: { label: string; value: string; strong?: boolean }[];
  notes?: string;
};
// True A4 PDFs, generated on the server. Font and layout code is shared by invoices/statements/estimates.
export async function createBusinessPdf(data: BusinessDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const company = documentCompany();
  const width = 595.28,
    height = 841.89,
    margin = 40,
    contentWidth = width - margin * 2;
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const ink = rgb(0.12, 0.16, 0.24),
    muted = rgb(0.4, 0.45, 0.52),
    accent = rgb(0.28, 0.3, 0.68);
  function safe(text: string, font: PDFFont = regular) {
    return [...text.replace(/[\r\n\t]/g, " ")]
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  }
  function draw(
    text: string,
    x: number,
    top: number,
    size = 9,
    font: PDFFont = regular,
    color = ink,
  ) {
    page.drawText(safe(text, font), { x, y: top - size, size, font, color });
  }
  function wrap(text: string, max: number, size = 9, font: PDFFont = regular) {
    const lines: string[] = [];
    let line = "";
    for (const word of safe(text, font).split(/\s+/)) {
      const candidate = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= max) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > max) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  function nextPage() {
    page = pdf.addPage([width, height]);
    y = height - margin;
    draw(company.name, margin, y, 12, bold, accent);
    draw(data.number, width - margin - 140, y, 10, bold);
    y -= 30;
  }
  function ensure(space: number) {
    if (y - space < 65) nextPage();
  }
  let logo;
  if (company.logoPath) {
    const base = path.resolve(process.cwd(), "public");
    const file = path.resolve(base, company.logoPath.replace(/^[/\\]+/, ""));
    if (file.startsWith(base + path.sep)) {
      try {
        const bytes = await readFile(file);
        logo = /\.jpe?g$/i.test(file) ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      } catch {
        /* Optional branding must not block a financial document. */
      }
    }
  }
  if (logo) {
    const scaled = logo.scaleToFit(55, 45);
    page.drawImage(logo, {
      x: margin,
      y: y - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
  }
  const nameX = logo ? margin + 65 : margin;
  for (const line of wrap(company.name, contentWidth - (nameX - margin), 21, bold)) {
    draw(line, nameX, y, 21, bold, accent);
    y -= 25;
  }
  for (const detail of [
    company.address,
    [company.phone, company.email].filter(Boolean).join(" | "),
    company.taxNumber ? `NTN: ${company.taxNumber}` : "",
  ].filter(Boolean)) {
    for (const line of wrap(detail, contentWidth)) {
      draw(line, margin, y, 9, regular, muted);
      y -= 13;
    }
  }
  y -= 22;
  draw(data.title, margin, y, 18, bold);
  y -= 25;
  draw(
    `${data.number} | ${data.date}${data.status ? " | " + data.status : ""}`,
    margin,
    y,
    10,
    bold,
  );
  y -= 24;
  draw(data.partyLabel.toUpperCase(), margin, y, 8, bold, muted);
  y -= 14;
  for (const detail of data.party.filter(Boolean)) {
    for (const line of wrap(detail, contentWidth)) {
      ensure(15);
      draw(line, margin, y, 10);
      y -= 14;
    }
  }
  for (const detail of data.metadata ?? []) {
    ensure(15);
    draw(detail, margin, y, 9, regular, muted);
    y -= 14;
  }
  y -= 20;
  const scale = contentWidth / data.columns.reduce((s, c) => s + c.width, 0);
  const widths = data.columns.map((c) => c.width * scale);
  function tableHeader() {
    ensure(28);
    page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: accent });
    let x = margin;
    data.columns.forEach((c, i) => {
      draw(c.label, x + 7, y - 6, 8, bold, rgb(1, 1, 1));
      x += widths[i]!;
    });
    y -= 25;
  }
  tableHeader();
  data.rows.forEach((row, index) => {
    const cellLines = data.columns.map((_, i) => wrap(row[i] ?? "", widths[i]! - 14, 8.5));
    const count = Math.max(...cellLines.map((l) => l.length));
    const rowHeight = Math.max(28, count * 12 + 14);
    if (y - rowHeight < 65) {
      nextPage();
      tableHeader();
    }
    // Long descriptions are wrapped; break rows across pages to keep arbitrary notes legible.
    let offset = 0;
    while (offset < count) {
      const capacity = Math.max(1, Math.floor((y - 65 - 14) / 12));
      const slice = Math.min(count - offset, capacity);
      const h = Math.max(28, slice * 12 + 14);
      if (index % 2 === 0)
        page.drawRectangle({
          x: margin,
          y: y - h,
          width: contentWidth,
          height: h,
          color: rgb(0.96, 0.97, 0.99),
        });
      let x = margin;
      cellLines.forEach((lines, i) => {
        lines.slice(offset, offset + slice).forEach((line, n) => {
          const fontWidth = regular.widthOfTextAtSize(safe(line), 8.5);
          draw(
            line,
            data.columns[i]!.right ? x + widths[i]! - 7 - fontWidth : x + 7,
            y - 8 - n * 12,
            8.5,
          );
        });
        x += widths[i]!;
      });
      y -= h;
      offset += slice;
      if (offset < count) {
        nextPage();
        tableHeader();
      }
    }
  });
  y -= 20;
  for (const total of data.totals) {
    ensure(25);
    if (total.strong)
      page.drawRectangle({
        x: width - margin - 275,
        y: y - 23,
        width: 275,
        height: 25,
        color: rgb(0.93, 0.94, 0.99),
      });
    draw(total.label, width - margin - 268, y - 5, 10, total.strong ? bold : regular);
    const font = total.strong ? bold : regular;
    draw(
      total.value,
      width - margin - font.widthOfTextAtSize(safe(total.value, font), 10) - 8,
      y - 5,
      10,
      font,
    );
    y -= 27;
  }
  if (data.notes) {
    y -= 12;
    ensure(25);
    draw("Notes", margin, y, 10, bold);
    y -= 17;
    for (const line of wrap(data.notes, contentWidth, 9)) {
      ensure(14);
      draw(line, margin, y, 9, regular, muted);
      y -= 14;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: margin, y: 48 },
      end: { x: width - margin, y: 48 },
      thickness: 0.5,
      color: rgb(0.8, 0.83, 0.88),
    });
    p.drawText("Computer Generated Document | All amounts in PKR", {
      x: margin,
      y: 32,
      font: regular,
      size: 8,
      color: muted,
    });
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: width - margin - 30,
      y: 32,
      font: regular,
      size: 8,
      color: muted,
    });
  });
  pdf.setTitle(`${data.title} ${data.number}`);
  pdf.setAuthor(company.name);
  return pdf.save();
}
export function pdfResponse(bytes: Uint8Array, filename: string, inline = false) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

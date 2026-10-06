import "server-only";

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "-");
}

function escapePdf(value: string) {
  return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapLine(value: string, width = 96) {
  const result: string[] = [];
  let remaining = ascii(value);
  if (!remaining) return [""];
  while (remaining.length > width) {
    let split = remaining.lastIndexOf(" ", width);
    if (split < width / 2) split = width;
    result.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  result.push(remaining);
  return result;
}

export function simpleTextPdf(title: string, lines: string[]) {
  const pageLines = lines
    .flatMap((line) => wrapLine(line))
    .reduce<string[][]>(
      (pages, line) => {
        const current = pages.at(-1)!;
        if (current.length >= 44) pages.push([]);
        pages.at(-1)!.push(line);
        return pages;
      },
      [[]],
    );
  const objects: string[] = [];
  const pageRefs = pageLines.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageLines.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pageLines.forEach((page, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const pageTitle = index === 0 ? title : `${title} (continued)`;
    const content = `BT /F1 14 Tf 42 800 Td (${escapePdf(pageTitle)}) Tj /F1 9 Tf 15 TL T* T* ${page.map((line) => `(${escapePdf(line)}) Tj T*`).join(" ")} ET BT /F1 8 Tf 500 24 Td (Page ${index + 1} of ${pageLines.length}) Tj ET`;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject + 1} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`;
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "ascii");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

export function pdfResponse(filename: string, data: Buffer) {
  const safeFilename = ascii(filename).replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

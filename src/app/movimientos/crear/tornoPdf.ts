import {
  getTornoPositions,
  formatTornoMeasure,
  EMPTY_TORNO_ROW,
  type TornoMedicionState,
  type TornoMeasurementField,
} from "./tornoMedicion.types";

type TornoPdfColumn = {
  key: TornoMeasurementField;
  label: string;
};

type TornoPdfArgs = {
  locomotiveNumber: string;
  movimientoId: number | null;
  comments: string;
  tornoMedicion: TornoMedicionState;
  columns: TornoPdfColumn[];
  profileTitle?: string;
};

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 24;

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function toAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}

function escapePdfText(text: string): string {
  return toAscii(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfY(topY: number): number {
  return PAGE_H - topY;
}

function rectTop(x: number, topY: number, w: number, h: number): string {
  return `${fmt(x)} ${fmt(pdfY(topY + h))} ${fmt(w)} ${fmt(h)} re`;
}

function rgb255(r: number, g: number, b: number): string {
  return `${fmt(r / 255)} ${fmt(g / 255)} ${fmt(b / 255)}`;
}

function writeText(args: {
  cmds: string[];
  text: string;
  x: number;
  topY: number;
  size: number;
  font?: "F1" | "F2";
  color?: [number, number, number];
}) {
  const { cmds, text, x, topY, size, font = "F1", color = [255, 255, 255] } = args;
  cmds.push(`${rgb255(color[0], color[1], color[2])} rg`);
  cmds.push("BT");
  cmds.push(`/${font} ${fmt(size)} Tf`);
  cmds.push(`${fmt(x)} ${fmt(pdfY(topY + size))} Td`);
  cmds.push(`(${escapePdfText(text)}) Tj`);
  cmds.push("ET");
}

function truncateByChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 3)}...`;
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = toAscii(text).trim();
  if (!clean) return [];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word.length > maxChars ? truncateByChars(word, maxChars) : word;
  }

  if (current) lines.push(current);
  return lines;
}

function buildPdf(content: string): string {
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n"
  );
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");
  objects.push(`6 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const objectText of objects) {
    offsets.push(pdf.length);
    pdf += objectText;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function buildContent(args: TornoPdfArgs): string {
  const { locomotiveNumber, movimientoId, comments, tornoMedicion, columns, profileTitle } = args;
  const dateText = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const positions = getTornoPositions(tornoMedicion.wheelCount);
  const cols = columns.length > 0 ? columns : [];

  const cmds: string[] = [];

  const cardX = MARGIN;
  const cardY = MARGIN;
  const cardW = PAGE_W - MARGIN * 2;
  const cardH = PAGE_H - MARGIN * 2;

  cmds.push(`${rgb255(255, 255, 255)} rg`);
  cmds.push(rectTop(cardX, cardY, cardW, cardH));
  cmds.push("f");

  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("1 w");
  cmds.push(rectTop(cardX, cardY, cardW, cardH));
  cmds.push("S");

  writeText({
    cmds,
    text: "Resumen de Medidas",
    x: cardX + 18,
    topY: cardY + 18,
    size: 16,
    font: "F2",
    color: [24, 24, 24],
  });

  writeText({
    cmds,
    text: profileTitle || "Formato Torno",
    x: cardX + 18,
    topY: cardY + 39,
    size: 10,
    color: [72, 72, 72],
  });

  const metaText = [
    `Unidad: ${locomotiveNumber || "-"}`,
    `Fecha: ${dateText}`,
    `Movimiento: ${movimientoId && movimientoId > 0 ? `#${movimientoId}` : "No disponible"}`,
  ].join("    ");
  writeText({
    cmds,
    text: metaText,
    x: cardX + 410,
    topY: cardY + 22,
    size: 10,
    font: "F2",
    color: [42, 42, 42],
  });

  const tableX = cardX + 18;
  const tableY = cardY + 60;
  const tableW = cardW - 36;
  const headerH = 24;
  const rowH = positions.length > 10 ? 20 : 22;
  const tableH = headerH + positions.length * rowH;

  cmds.push(`${rgb255(246, 246, 246)} rg`);
  cmds.push(rectTop(tableX, tableY, tableW, headerH));
  cmds.push("f");

  cmds.push(`${rgb255(196, 196, 196)} RG`);
  cmds.push("0.8 w");
  cmds.push(rectTop(tableX, tableY, tableW, tableH));
  cmds.push("S");

  const posColW = 62;
  const dynamicColW = cols.length > 0 ? (tableW - posColW) / cols.length : tableW - posColW;

  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("0.6 w");
  cmds.push(`${fmt(tableX + posColW)} ${fmt(pdfY(tableY + tableH))} m ${fmt(tableX + posColW)} ${fmt(pdfY(tableY))} l S`);

  for (let col = 1; col < cols.length; col += 1) {
    const x = tableX + posColW + dynamicColW * col;
    cmds.push(`${fmt(x)} ${fmt(pdfY(tableY + tableH))} m ${fmt(x)} ${fmt(pdfY(tableY))} l S`);
  }

  for (let row = 1; row <= positions.length; row += 1) {
    const y = tableY + headerH + rowH * row;
    cmds.push(`${fmt(tableX)} ${fmt(pdfY(y))} m ${fmt(tableX + tableW)} ${fmt(pdfY(y))} l S`);
  }

  writeText({
    cmds,
    text: "Posicion",
    x: tableX + 8,
    topY: tableY + 7,
    size: 9,
    font: "F2",
    color: [18, 18, 18],
  });

  cols.forEach((column, index) => {
    const x = tableX + posColW + dynamicColW * index + 7;
    const maxChars = Math.max(8, Math.floor((dynamicColW - 10) / 5));
    writeText({
      cmds,
      text: truncateByChars(column.label, maxChars).toUpperCase(),
      x,
      topY: tableY + 7,
      size: 8.5,
      font: "F2",
      color: [18, 18, 18],
    });
  });

  positions.forEach((position, rowIndex) => {
    const rowTop = tableY + headerH + rowH * rowIndex + 6;
    const row = tornoMedicion.rows[position] ?? EMPTY_TORNO_ROW;

    writeText({
      cmds,
      text: position,
      x: tableX + 10,
      topY: rowTop,
      size: 10,
      font: "F2",
      color: [16, 16, 16],
    });

    cols.forEach((column, colIndex) => {
      const rawValue = formatTornoMeasure(row[column.key]) || "-";
      const maxChars = Math.max(5, Math.floor((dynamicColW - 12) / 5.4));
      const text = truncateByChars(rawValue, maxChars);
      const x = tableX + posColW + dynamicColW * colIndex + 8;
      writeText({
        cmds,
        text,
        x,
        topY: rowTop,
        size: 9.5,
        color: [38, 38, 38],
      });
    });
  });

  const obsY = tableY + tableH + 14;
  const obsH = cardY + cardH - obsY - 18;
  cmds.push(`${rgb255(255, 255, 255)} rg`);
  cmds.push(rectTop(tableX, obsY, tableW, obsH));
  cmds.push("f");
  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("0.8 w");
  cmds.push(rectTop(tableX, obsY, tableW, obsH));
  cmds.push("S");

  writeText({
    cmds,
    text: "Observaciones y Comentarios",
    x: tableX + 10,
    topY: obsY + 10,
    size: 11,
    font: "F2",
    color: [18, 18, 18],
  });

  const obsLines = wrapText(comments.trim() || "Sin comentarios.", 150).slice(0, 4);
  obsLines.forEach((line, index) => {
    writeText({
      cmds,
      text: line,
      x: tableX + 10,
      topY: obsY + 30 + index * 12,
      size: 10,
      color: [50, 50, 50],
    });
  });

  return cmds.join("\n");
}

/** Genera y descarga un PDF con tabla de medidas (sin dependencias externas). */
export function downloadTornoPdf(args: TornoPdfArgs): string {
  const content = buildContent(args);
  const pdfContent = buildPdf(content);
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const fileDate = new Date().toISOString().slice(0, 10);
  const unit = (args.locomotiveNumber || "unidad").replace(/[^\w-]+/g, "_");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `torno_${unit}_${fileDate}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return anchor.download;
}

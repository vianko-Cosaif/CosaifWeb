import type { TornoHistoryItem, TornoMeasures, TornoMeasurePosition } from "./types";

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 24;

const POSITIONS: TornoMeasurePosition[] = [
  "L1", "R1",
  "L2", "R2",
  "L3", "R3",
  "L4", "R4",
  "L5", "R5",
  "L6", "R6",
];

type PdfRow = {
  position: TornoMeasurePosition;
  measure: string;
  start: string;
  end: string;
};

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

function truncate(text: string, maxChars: number): string {
  const clean = toAscii(String(text || "")).trim();
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 3) return clean.slice(0, maxChars);
  return `${clean.slice(0, maxChars - 3)}...`;
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
  const { cmds, text, x, topY, size, font = "F1", color = [30, 41, 59] } = args;
  cmds.push(`${rgb255(color[0], color[1], color[2])} rg`);
  cmds.push("BT");
  cmds.push(`/${font} ${fmt(size)} Tf`);
  cmds.push(`${fmt(x)} ${fmt(pdfY(topY + size))} Td`);
  cmds.push(`(${escapePdfText(text)}) Tj`);
  cmds.push("ET");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatValue(value: string | number | null | undefined) {
  if (value == null || value === "") return "-";
  const raw = String(value).trim();
  if (/^NO[_\s-]?APLICA$/i.test(raw)) return "No aplica";
  return raw;
}

function measureParts(value: string | number | null | undefined) {
  const raw = formatValue(value);
  if (raw === "-") return [];
  if (raw === "No aplica") return [{ label: "Resultado", value: raw }];

  return raw
    .split(/\s*\|\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator === -1) return { label: "Resultado", value: part };
      return {
        label: part.slice(0, separator).trim() || "Medida",
        value: part.slice(separator + 1).trim() || "-",
      };
    });
}

function partsByLabel(value: string | number | null | undefined) {
  const map = new Map<string, string>();
  for (const part of measureParts(value)) {
    map.set(part.label, part.value);
  }
  return map;
}

function buildRows(start?: TornoMeasures, end?: TornoMeasures): PdfRow[] {
  const rows: PdfRow[] = [];

  for (const position of POSITIONS) {
    const startMap = partsByLabel(start?.[position]);
    const endMap = partsByLabel(end?.[position]);
    const labels = Array.from(new Set([...startMap.keys(), ...endMap.keys()]));

    labels.forEach((label) => {
      rows.push({
        position,
        measure: label,
        start: startMap.get(label) ?? "-",
        end: endMap.get(label) ?? "-",
      });
    });
  }

  return rows;
}

function buildPdf(pages: string[]): string {
  const objects: string[] = [];
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`);
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

  pages.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    objects.push(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  });

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

function drawPage(args: {
  item: TornoHistoryItem;
  rows: PdfRow[];
  pageIndex: number;
  pageCount: number;
}) {
  const { item, rows, pageIndex, pageCount } = args;
  const cmds: string[] = [];
  const contentW = PAGE_W - MARGIN * 2;

  cmds.push(`${rgb255(255, 255, 255)} rg`);
  cmds.push(rectTop(0, 0, PAGE_W, PAGE_H));
  cmds.push("f");

  cmds.push(`${rgb255(248, 250, 252)} rg`);
  cmds.push(rectTop(MARGIN, MARGIN, contentW, PAGE_H - MARGIN * 2));
  cmds.push("f");
  cmds.push(`${rgb255(203, 213, 225)} RG`);
  cmds.push("1 w");
  cmds.push(rectTop(MARGIN, MARGIN, contentW, PAGE_H - MARGIN * 2));
  cmds.push("S");

  writeText({
    cmds,
    text: "Especificaciones iniciales y finales",
    x: MARGIN + 18,
    topY: MARGIN + 18,
    size: 16,
    font: "F2",
    color: [15, 23, 42],
  });
  writeText({
    cmds,
    text: `Detalle Torno - Locomotora ${item.locomotive ?? item.numeroLocomotora ?? "-"}`,
    x: MARGIN + 18,
    topY: MARGIN + 40,
    size: 10,
    font: "F2",
    color: [51, 65, 85],
  });

  const meta = [
    `Estado: ${item.status || "-"}`,
    `Servicio: ${item.service ?? "Torno"}`,
    `Inicio: ${formatDate(item.startAt)}`,
    `Fin: ${formatDate(item.endAt)}`,
    `Fecha: ${formatDate(item.date)}`,
    `Tornero: ${item.operator || "-"}`,
  ];
  writeText({
    cmds,
    text: truncate(meta.join("    "), 150),
    x: MARGIN + 18,
    topY: MARGIN + 62,
    size: 8.5,
    color: [71, 85, 105],
  });

  const tableX = MARGIN + 18;
  const tableY = MARGIN + 90;
  const tableW = contentW - 36;
  const headerH = 24;
  const rowH = 17;
  const colW = {
    position: 62,
    measure: 292,
    start: 205,
    end: 205,
  };

  cmds.push(`${rgb255(226, 232, 240)} rg`);
  cmds.push(rectTop(tableX, tableY, tableW, headerH));
  cmds.push("f");
  cmds.push(`${rgb255(148, 163, 184)} RG`);
  cmds.push("0.8 w");
  cmds.push(rectTop(tableX, tableY, tableW, headerH + Math.max(rows.length, 1) * rowH));
  cmds.push("S");

  const dividers = [
    tableX + colW.position,
    tableX + colW.position + colW.measure,
    tableX + colW.position + colW.measure + colW.start,
  ];
  dividers.forEach((x) => {
    cmds.push(`${fmt(x)} ${fmt(pdfY(tableY + headerH + Math.max(rows.length, 1) * rowH))} m ${fmt(x)} ${fmt(pdfY(tableY))} l S`);
  });

  const headers = [
    ["Posicion", tableX + 8],
    ["Especificacion", tableX + colW.position + 8],
    ["Inicio", tableX + colW.position + colW.measure + 8],
    ["Fin", tableX + colW.position + colW.measure + colW.start + 8],
  ] as const;
  headers.forEach(([text, x]) => {
    writeText({ cmds, text, x, topY: tableY + 8, size: 9, font: "F2", color: [15, 23, 42] });
  });

  if (!rows.length) {
    writeText({
      cmds,
      text: "Sin medidas registradas.",
      x: tableX + 10,
      topY: tableY + headerH + 8,
      size: 10,
      color: [71, 85, 105],
    });
  }

  rows.forEach((row, index) => {
    const rowTop = tableY + headerH + index * rowH;
    const lineY = rowTop + rowH;
    cmds.push(`${rgb255(203, 213, 225)} RG`);
    cmds.push(`${fmt(tableX)} ${fmt(pdfY(lineY))} m ${fmt(tableX + tableW)} ${fmt(pdfY(lineY))} l S`);

    writeText({ cmds, text: row.position, x: tableX + 10, topY: rowTop + 5, size: 8.5, font: "F2", color: [15, 23, 42] });
    writeText({ cmds, text: truncate(row.measure, 44), x: tableX + colW.position + 8, topY: rowTop + 5, size: 8.5, color: [51, 65, 85] });
    writeText({ cmds, text: truncate(row.start, 32), x: tableX + colW.position + colW.measure + 8, topY: rowTop + 5, size: 8.5, color: [8, 51, 68] });
    writeText({ cmds, text: truncate(row.end, 32), x: tableX + colW.position + colW.measure + colW.start + 8, topY: rowTop + 5, size: 8.5, color: [20, 83, 45] });
  });

  writeText({
    cmds,
    text: `Pagina ${pageIndex + 1} de ${pageCount}`,
    x: PAGE_W - MARGIN - 82,
    topY: PAGE_H - MARGIN - 14,
    size: 8,
    color: [100, 116, 139],
  });

  return cmds.join("\n");
}

export function downloadTornoHistoryPdf(item: TornoHistoryItem): string {
  const rows = buildRows(item.measuresRequested, item.measuresFinal);
  const rowsPerPage = 24;
  const chunks: PdfRow[][] = [];

  if (!rows.length) {
    chunks.push([]);
  } else {
    for (let index = 0; index < rows.length; index += rowsPerPage) {
      chunks.push(rows.slice(index, index + rowsPerPage));
    }
  }

  const pages = chunks.map((chunk, index) =>
    drawPage({
      item,
      rows: chunk,
      pageIndex: index,
      pageCount: chunks.length,
    })
  );
  const pdfContent = buildPdf(pages);
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const fileDate = new Date().toISOString().slice(0, 10);
  const unit = String(item.locomotive ?? item.numeroLocomotora ?? "unidad").replace(/[^\w-]+/g, "_");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `torno_historial_${unit}_${fileDate}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return anchor.download;
}

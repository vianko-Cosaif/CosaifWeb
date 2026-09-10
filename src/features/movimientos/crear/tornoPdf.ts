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

type TornoHistoryMeasures = Partial<Record<string, string | number | null | undefined>>;

type TornoHistoryPdfArgs = {
  locomotiveNumber: string | number | null | undefined;
  movimientoId?: string | number | null;
  servicioId?: string | number | null;
  status?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  previousMeasures?: TornoHistoryMeasures;
  finalMeasures?: TornoHistoryMeasures;
  columns?: string[];
  comments?: string | null;
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

function normalizeWheelValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const text = String(value).trim();
  if (!text || /^NO[_\s-]?APLICA$/i.test(text)) return "";
  return text;
}

function parseHistoryMeasure(value: string | number | null | undefined): Record<string, string> {
  const text = normalizeWheelValue(value);
  if (!text) return {};

  const chunks = text
    .split(/\s*\|\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return chunks.reduce<Record<string, string>>((acc, chunk) => {
    const separator = chunk.indexOf(":");
    if (separator < 0) {
      acc.Medida = chunk;
      return acc;
    }

    const label = chunk.slice(0, separator).trim() || "Medida";
    const measureValue = chunk.slice(separator + 1).trim();
    if (measureValue) acc[label] = measureValue;
    return acc;
  }, {});
}

function normalizeHistoryLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getHistoryMeasureValue(values: Record<string, string>, column: string): string {
  const aliases: Record<string, string[]> = {
    pisada: ["desgaste de pisada"],
    espesor: ["espesor de ceja"],
    altura: ["altura de ceja"],
  };
  const target = normalizeHistoryLabel(column);
  const accepted = new Set([target, ...(aliases[target] ?? [])]);
  const match = Object.entries(values).find(([label]) => accepted.has(normalizeHistoryLabel(label)));
  return match?.[1] ?? "";
}

function getCellMaxChars(columnWidth: number, fontSize = 8.5): number {
  return Math.max(5, Math.floor((columnWidth - 16) / (fontSize * 0.54)));
}

function wrapCellValue(value: string, maxChars: number, maxLines = 3): string[] {
  const lines = wrapText(value || "-", maxChars);
  return (lines.length ? lines : ["-"]).slice(0, maxLines);
}

function buildMeasureRowHeights(args: {
  positions: string[];
  columns: string[];
  measures?: TornoHistoryMeasures;
  columnWidth: number;
  minimum: number;
}) {
  const maxChars = getCellMaxChars(args.columnWidth);
  return args.positions.map((position) => {
    const values = parseHistoryMeasure(
      args.measures?.[position] ?? args.measures?.[position.toLowerCase()],
    );
    const maxLines = Math.max(
      1,
      ...args.columns.map((column) =>
        wrapCellValue(getHistoryMeasureValue(values, column) || "-", maxChars).length,
      ),
    );
    return Math.min(54, Math.max(args.minimum, 14 + maxLines * 11));
  });
}

function buildComparisonRowHeights(args: {
  positions: string[];
  columns: string[];
  previousMeasures?: TornoHistoryMeasures;
  finalMeasures?: TornoHistoryMeasures;
  columnWidth: number;
}) {
  const maxChars = getCellMaxChars(args.columnWidth, 8);
  return args.positions.map((position) => {
    const previous = parseHistoryMeasure(
      args.previousMeasures?.[position] ?? args.previousMeasures?.[position.toLowerCase()],
    );
    const current = parseHistoryMeasure(
      args.finalMeasures?.[position] ?? args.finalMeasures?.[position.toLowerCase()],
    );
    const requiredLines = Math.max(
      2,
      ...args.columns.map((column) => {
        const previousLines = wrapCellValue(
          `P: ${getHistoryMeasureValue(previous, column) || "-"}`,
          maxChars,
          2,
        ).length;
        const currentLines = wrapCellValue(
          `A: ${getHistoryMeasureValue(current, column) || "-"}`,
          maxChars,
          2,
        ).length;
        return previousLines + currentLines;
      }),
    );
    return Math.min(64, Math.max(38, 10 + requiredLines * 11));
  });
}

function chunkPositionsByHeight(
  positions: string[],
  rowHeights: number[],
  maxRowsHeight: number,
): string[][] {
  if (!positions.length) return [[]];

  const chunks: string[][] = [];
  let current: string[] = [];
  let currentHeight = 0;

  positions.forEach((position, index) => {
    const rowHeight = rowHeights[index] ?? 38;
    if (current.length && currentHeight + rowHeight > maxRowsHeight) {
      chunks.push(current);
      current = [];
      currentHeight = 0;
    }

    current.push(position);
    currentHeight += rowHeight;
  });

  if (current.length) chunks.push(current);
  return chunks;
}

function orderedHistoryPositions(previous?: TornoHistoryMeasures, final?: TornoHistoryMeasures): string[] {
  const base = ["L1", "R1", "L2", "R2", "L3", "R3", "L4", "R4", "L5", "R5", "L6", "R6"];
  const present = new Set([...Object.keys(previous ?? {}), ...Object.keys(final ?? {})].map((key) => key.toUpperCase()));
  return base.filter((position) => present.has(position));
}

function collectHistoryColumns(
  positions: string[],
  previous?: TornoHistoryMeasures,
  final?: TornoHistoryMeasures,
): string[] {
  const columns = new Set<string>();
  positions.forEach((position) => {
    Object.keys(parseHistoryMeasure(previous?.[position] ?? previous?.[position.toLowerCase()])).forEach((key) => columns.add(key));
    Object.keys(parseHistoryMeasure(final?.[position] ?? final?.[position.toLowerCase()])).forEach((key) => columns.add(key));
  });
  return Array.from(columns);
}

function formatReportDate(value?: string | null): string {
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

function buildPdfPages(contents: string[]): string {
  const safeContents = contents.length ? contents : [""];
  const objects: string[] = [];
  const regularFontId = 3;
  const boldFontId = 4;
  const pageIds = safeContents.map((_, index) => 5 + index * 2);

  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`;
  objects[regularFontId] = `${regularFontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[boldFontId] = `${boldFontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  safeContents.forEach((content, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    objects[pageId] =
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] ` +
      `/Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>\nendobj\n`;
    objects[contentId] = `${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  const objectCount = objects.length - 1;
  for (let id = 1; id <= objectCount; id += 1) {
    const objectText = objects[id];
    offsets.push(pdf.length);
    pdf += objectText;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objectCount; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function buildPdf(content: string): string {
  return buildPdfPages([content]);
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

function drawHistoryMeasureTable(args: {
  cmds: string[];
  title: string;
  x: number;
  y: number;
  w: number;
  positions: string[];
  columns: string[];
  measures?: TornoHistoryMeasures;
  rowH?: number;
}) {
  const { cmds, title, x, y, w, positions, columns, measures, rowH = 12 } = args;
  const headerH = 24;
  const titleH = 24;
  const posColW = 46;
  const measureColW = columns.length > 0 ? (w - posColW) / columns.length : w - posColW;
  const rowHeights = positions.length
    ? buildMeasureRowHeights({
        positions,
        columns,
        measures,
        columnWidth: measureColW,
        minimum: rowH,
      })
    : [rowH];
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const tableH = titleH + headerH + rowsHeight;

  cmds.push(`${rgb255(255, 255, 255)} rg`);
  cmds.push(rectTop(x, y, w, tableH));
  cmds.push("f");
  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("0.8 w");
  cmds.push(rectTop(x, y, w, tableH));
  cmds.push("S");

  cmds.push(`${rgb255(247, 247, 247)} rg`);
  cmds.push(rectTop(x, y, w, titleH));
  cmds.push("f");
  writeText({ cmds, text: title, x: x + 12, topY: y + 7, size: 11, font: "F2", color: [18, 18, 18] });

  const headY = y + titleH;
  cmds.push(`${rgb255(251, 251, 251)} rg`);
  cmds.push(rectTop(x, headY, w, headerH));
  cmds.push("f");

  writeText({ cmds, text: "Rueda", x: x + 10, topY: headY + 8, size: 8.5, font: "F2", color: [18, 18, 18] });
  columns.forEach((column, index) => {
    writeText({
      cmds,
      text: truncateByChars(column, Math.max(6, Math.floor((measureColW - 8) / 4.6))).toUpperCase(),
      x: x + posColW + measureColW * index + 8,
      topY: headY + 8,
      size: 7.8,
      font: "F2",
      color: [18, 18, 18],
    });
  });

  const gridTop = y + titleH;
  const gridH = headerH + rowsHeight;
  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("0.5 w");
  cmds.push(`${fmt(x + posColW)} ${fmt(pdfY(gridTop + gridH))} m ${fmt(x + posColW)} ${fmt(pdfY(gridTop))} l S`);
  for (let col = 1; col < columns.length; col += 1) {
    const lineX = x + posColW + measureColW * col;
    cmds.push(`${fmt(lineX)} ${fmt(pdfY(gridTop + gridH))} m ${fmt(lineX)} ${fmt(pdfY(gridTop))} l S`);
  }
  let rowBoundaryY = y + titleH + headerH;
  cmds.push(`${fmt(x)} ${fmt(pdfY(rowBoundaryY))} m ${fmt(x + w)} ${fmt(pdfY(rowBoundaryY))} l S`);
  rowHeights.forEach((height) => {
    rowBoundaryY += height;
    const lineY = rowBoundaryY;
    cmds.push(`${fmt(x)} ${fmt(pdfY(lineY))} m ${fmt(x + w)} ${fmt(pdfY(lineY))} l S`);
  });

  if (!positions.length) {
    writeText({ cmds, text: "Sin medidas", x: x + 8, topY: y + titleH + headerH + 6, size: 8, color: [72, 72, 72] });
    return tableH;
  }

  let accumulatedRowHeight = 0;
  positions.forEach((position, rowIndex) => {
    const rowTop = y + titleH + headerH + accumulatedRowHeight;
    const currentRowHeight = rowHeights[rowIndex];
    const values = parseHistoryMeasure(measures?.[position] ?? measures?.[position.toLowerCase()]);
    writeText({
      cmds,
      text: position,
      x: x + 10,
      topY: rowTop + Math.max(8, (currentRowHeight - 10) / 2),
      size: 9.5,
      font: "F2",
      color: [18, 18, 18],
    });
    columns.forEach((column, colIndex) => {
      const lines = wrapCellValue(
        getHistoryMeasureValue(values, column) || "-",
        getCellMaxChars(measureColW),
      );
      const contentHeight = lines.length * 11;
      const contentTop = rowTop + Math.max(7, (currentRowHeight - contentHeight) / 2);
      lines.forEach((line, lineIndex) => {
        writeText({
          cmds,
          text: line,
          x: x + posColW + measureColW * colIndex + 8,
          topY: contentTop + lineIndex * 11,
          size: 8.5,
          color: [38, 38, 38],
        });
      });
    });
    accumulatedRowHeight += currentRowHeight;
  });

  return tableH;
}

function drawHistoryComparisonTable(args: {
  cmds: string[];
  x: number;
  y: number;
  w: number;
  positions: string[];
  columns: string[];
  previousMeasures?: TornoHistoryMeasures;
  finalMeasures?: TornoHistoryMeasures;
}) {
  const { cmds, x, y, w, positions, columns, previousMeasures, finalMeasures } = args;
  const headerH = 24;
  const titleH = 24;
  const posColW = 46;
  const measureColW = columns.length > 0 ? (w - posColW) / columns.length : w - posColW;
  const rowHeights = positions.length
    ? buildComparisonRowHeights({
        positions,
        columns,
        previousMeasures,
        finalMeasures,
        columnWidth: measureColW,
      })
    : [38];
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const tableH = titleH + headerH + rowsHeight;

  cmds.push(`${rgb255(255, 255, 255)} rg`);
  cmds.push(rectTop(x, y, w, tableH));
  cmds.push("f");
  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("0.8 w");
  cmds.push(rectTop(x, y, w, tableH));
  cmds.push("S");

  cmds.push(`${rgb255(247, 247, 247)} rg`);
  cmds.push(rectTop(x, y, w, titleH));
  cmds.push("f");
  writeText({ cmds, text: "Comparativa previa / actual", x: x + 12, topY: y + 7, size: 11, font: "F2", color: [18, 18, 18] });

  const headY = y + titleH;
  cmds.push(`${rgb255(251, 251, 251)} rg`);
  cmds.push(rectTop(x, headY, w, headerH));
  cmds.push("f");
  writeText({ cmds, text: "Rueda", x: x + 10, topY: headY + 8, size: 8.5, font: "F2", color: [18, 18, 18] });
  columns.forEach((column, index) => {
    writeText({
      cmds,
      text: truncateByChars(column, Math.max(8, Math.floor((measureColW - 10) / 5))).toUpperCase(),
      x: x + posColW + measureColW * index + 8,
      topY: headY + 8,
      size: 7.8,
      font: "F2",
      color: [18, 18, 18],
    });
  });

  cmds.push(`${rgb255(214, 214, 214)} RG`);
  cmds.push("0.5 w");
  cmds.push(`${fmt(x + posColW)} ${fmt(pdfY(y + tableH))} m ${fmt(x + posColW)} ${fmt(pdfY(headY))} l S`);
  for (let col = 1; col < columns.length; col += 1) {
    const lineX = x + posColW + measureColW * col;
    cmds.push(`${fmt(lineX)} ${fmt(pdfY(y + tableH))} m ${fmt(lineX)} ${fmt(pdfY(headY))} l S`);
  }
  let rowBoundaryY = y + titleH + headerH;
  cmds.push(`${fmt(x)} ${fmt(pdfY(rowBoundaryY))} m ${fmt(x + w)} ${fmt(pdfY(rowBoundaryY))} l S`);
  rowHeights.forEach((height) => {
    rowBoundaryY += height;
    const lineY = rowBoundaryY;
    cmds.push(`${fmt(x)} ${fmt(pdfY(lineY))} m ${fmt(x + w)} ${fmt(pdfY(lineY))} l S`);
  });

  if (!positions.length) {
    writeText({ cmds, text: "Sin medidas para comparar", x: x + 8, topY: y + titleH + headerH + 6, size: 8, color: [72, 72, 72] });
    return tableH;
  }

  let accumulatedRowHeight = 0;
  positions.forEach((position, rowIndex) => {
    const rowTop = y + titleH + headerH + accumulatedRowHeight;
    const currentRowHeight = rowHeights[rowIndex];
    const prev = parseHistoryMeasure(previousMeasures?.[position] ?? previousMeasures?.[position.toLowerCase()]);
    const current = parseHistoryMeasure(finalMeasures?.[position] ?? finalMeasures?.[position.toLowerCase()]);
    writeText({
      cmds,
      text: position,
      x: x + 10,
      topY: rowTop + Math.max(12, (currentRowHeight - 10) / 2),
      size: 9.5,
      font: "F2",
      color: [18, 18, 18],
    });

    columns.forEach((column, colIndex) => {
      const cellX = x + posColW + measureColW * colIndex + 8;
      const maxChars = getCellMaxChars(measureColW, 8);
      const previousLines = wrapCellValue(
        `P: ${getHistoryMeasureValue(prev, column) || "-"}`,
        maxChars,
        2,
      );
      const currentLines = wrapCellValue(
        `A: ${getHistoryMeasureValue(current, column) || "-"}`,
        maxChars,
        2,
      );
      const totalLines = previousLines.length + currentLines.length;
      const contentTop = rowTop + Math.max(6, (currentRowHeight - totalLines * 11) / 2);

      previousLines.forEach((line, lineIndex) => {
        writeText({
          cmds,
          text: line,
          x: cellX,
          topY: contentTop + lineIndex * 11,
          size: 8,
          color: [92, 92, 92],
        });
      });
      currentLines.forEach((line, lineIndex) => {
        writeText({
          cmds,
          text: line,
          x: cellX,
          topY: contentTop + (previousLines.length + lineIndex) * 11,
          size: 8.2,
          font: "F2",
          color: [18, 18, 18],
        });
      });
    });
    accumulatedRowHeight += currentRowHeight;
  });

  return tableH;
}

function buildHistoryContents(args: TornoHistoryPdfArgs): string[] {
  const dateText = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const positions = orderedHistoryPositions(args.previousMeasures, args.finalMeasures);
  const columns = args.columns?.filter(Boolean) ?? collectHistoryColumns(positions, args.previousMeasures, args.finalMeasures);
  const safeColumns = columns.length ? columns : ["Medida"];
  const tableW = PAGE_W - MARGIN * 2 - 44;
  const positionColumnW = 46;
  const measureColumnW = safeColumns.length > 0
    ? (tableW - positionColumnW) / safeColumns.length
    : tableW - positionColumnW;
  const tableTitleAndHeaderHeight = 48;
  const tableTop = MARGIN + 72;
  const tableBottom = PAGE_H - MARGIN - 42;
  const maxRowsHeight = tableBottom - tableTop - tableTitleAndHeaderHeight;

  const previousChunks = chunkPositionsByHeight(
    positions,
    buildMeasureRowHeights({
      positions,
      columns: safeColumns,
      measures: args.previousMeasures,
      columnWidth: measureColumnW,
      minimum: 30,
    }),
    maxRowsHeight,
  );
  const finalChunks = chunkPositionsByHeight(
    positions,
    buildMeasureRowHeights({
      positions,
      columns: safeColumns,
      measures: args.finalMeasures,
      columnWidth: measureColumnW,
      minimum: 30,
    }),
    maxRowsHeight,
  );
  const comparisonChunks = chunkPositionsByHeight(
    positions,
    buildComparisonRowHeights({
      positions,
      columns: safeColumns,
      previousMeasures: args.previousMeasures,
      finalMeasures: args.finalMeasures,
      columnWidth: measureColumnW,
    }),
    maxRowsHeight,
  );

  const createPage = (
    pageTitle: string,
    renderTable: (layout: {
      cmds: string[];
      tableX: number;
      tableY: number;
      tableW: number;
    }) => void,
  ) => {
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
      text: "Reporte de Torneado",
      x: cardX + 22,
      topY: cardY + 15,
      size: 18,
      font: "F2",
      color: [24, 24, 24],
    });
    writeText({
      cmds,
      text: pageTitle,
      x: cardX + 22,
      topY: cardY + 40,
      size: 11.5,
      color: [72, 72, 72],
    });

    const metaText = [
      `Unidad: ${args.locomotiveNumber || "-"}`,
      `Movimiento: ${args.movimientoId ? `#${args.movimientoId}` : "-"}`,
      `Servicio: ${args.servicioId ? `#${args.servicioId}` : "-"}`,
      `Estado: ${args.status || "-"}`,
    ].join("    ");
    writeText({
      cmds,
      text: metaText,
      x: cardX + 300,
      topY: cardY + 17,
      size: 9.5,
      font: "F2",
      color: [42, 42, 42],
    });
    writeText({
      cmds,
      text: `Inicio: ${formatReportDate(args.startAt)}    Fin: ${formatReportDate(args.endAt)}    Generado: ${dateText}`,
      x: cardX + 300,
      topY: cardY + 39,
      size: 9,
      color: [72, 72, 72],
    });

    renderTable({
      cmds,
      tableX: cardX + 22,
      tableY: cardY + 72,
      tableW: cardW - 44,
    });

    writeText({
      cmds,
      text: truncateByChars(args.comments?.trim() || "Documento digital de operacion de torno.", 150),
      x: cardX + 22,
      topY: cardY + cardH - 18,
      size: 9.5,
      color: [92, 92, 92],
    });

    return cmds.join("\n");
  };

  const withContinuation = (title: string, index: number, total: number) =>
    total > 1 ? `${title} (${index + 1}/${total})` : title;

  return [
    ...previousChunks.map((pagePositions, index) =>
      createPage(
        withContinuation("Medidas previas solicitadas", index, previousChunks.length),
        ({ cmds, tableX, tableY, tableW }) => {
      drawHistoryMeasureTable({
        cmds,
        title: "Medidas previas",
        x: tableX,
        y: tableY,
        w: tableW,
        positions: pagePositions,
        columns: safeColumns,
        measures: args.previousMeasures,
        rowH: 30,
      });
        },
      ),
    ),
    ...finalChunks.map((pagePositions, index) =>
      createPage(
        withContinuation("Medidas actuales al finalizar el torneado", index, finalChunks.length),
        ({ cmds, tableX, tableY, tableW }) => {
      drawHistoryMeasureTable({
        cmds,
        title: "Medidas actuales",
        x: tableX,
        y: tableY,
        w: tableW,
        positions: pagePositions,
        columns: safeColumns,
        measures: args.finalMeasures,
        rowH: 30,
      });
        },
      ),
    ),
    ...comparisonChunks.map((pagePositions, index) =>
      createPage(
        withContinuation("Comparativa de medidas previas y actuales", index, comparisonChunks.length),
        ({ cmds, tableX, tableY, tableW }) => {
      drawHistoryComparisonTable({
        cmds,
        x: tableX,
        y: tableY,
        w: tableW,
        positions: pagePositions,
        columns: safeColumns,
        previousMeasures: args.previousMeasures,
        finalMeasures: args.finalMeasures,
      });
        },
      ),
    ),
  ];
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

/** Genera y descarga el PDF historico del detalle de torno con las tres tablas del flujo. */
export function downloadTornoHistoryPdf(args: TornoHistoryPdfArgs): string {
  const contents = buildHistoryContents(args);
  const pdfContent = buildPdfPages(contents);
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const fileDate = new Date().toISOString().slice(0, 10);
  const unit = String(args.locomotiveNumber || "unidad").replace(/[^\w-]+/g, "_");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reporte_torno_${unit}_${fileDate}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return anchor.download;
}

import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = path.dirname(new URL(import.meta.url).pathname);
const inputPath = path.join(outputDir, "COSAIF_Reporte_Comercial_Verificacion.xlsx");
const renderDir = path.join(outputDir, "renders");
const expectedSheets = [
  "Resumen",
  "Naturales",
  "Arrastre",
  "Tendencia del periodo",
  "Volumen por patio",
  "Cartera de clientes",
  "Contratos",
  "Cumplimiento contractual",
  "Cortes y estados",
  "Control financiero",
  "Detalle financiero",
  "Excedentes cobrables",
  "Pagos registrados",
  "Historial de cortes",
  "Operaciones auditables",
  "Guía del archivo",
];

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const overview = await workbook.inspect({ kind: "workbook,sheet", include: "id,name", maxChars: 12000 });
const formulas = await workbook.inspect({ kind: "formula", sheetId: "Control financiero", range: "A1:H15", maxChars: 12000, options: { maxResults: 100 } });
const cuts = await workbook.inspect({ kind: "region", sheetId: "Cortes y estados", range: "A1:Z5", maxChars: 16000, tableMaxRows: 6, tableMaxCols: 26 });
const financial = await workbook.inspect({ kind: "region", sheetId: "Detalle financiero", range: "A1:S7", maxChars: 16000, tableMaxRows: 8, tableMaxCols: 19 });

await fs.mkdir(renderDir, { recursive: true });
for (const sheetName of expectedSheets) {
  const blob = await workbook.render({ sheetName, autoCrop: "all", scale: 0.8, format: "png" });
  const safeName = sheetName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  await fs.writeFile(path.join(renderDir, `${safeName}.png`), new Uint8Array(await blob.arrayBuffer()));
}

const report = {
  workbook: overview.ndjson,
  formulas: formulas.ndjson,
  cuts: cuts.ndjson,
  financial: financial.ndjson,
  renderedSheets: expectedSheets,
};
await fs.writeFile(path.join(outputDir, "artifact-tool-verification.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ rendered: expectedSheets.length, verification: path.join(outputDir, "artifact-tool-verification.json") }));

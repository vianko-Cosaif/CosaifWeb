import type {
  DynamicTableColumn,
  DynamicTablePriority,
  ResolvedDynamicTableColumn,
} from "./types";

export const DEFAULT_TABLE_HEIGHT = 460;
export const DEFAULT_ROW_HEIGHT = 44;
export const DEFAULT_HEADER_HEIGHT = 48;
export const DEFAULT_COLUMN_WIDTH = 160;

export function readCellValue<T>(row: T, key: keyof T | string): unknown {
  return (row as Record<string, unknown>)[String(key)];
}

export function toCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function clampPriority(priority?: DynamicTablePriority): DynamicTablePriority {
  if (!priority) return 5;
  return priority;
}

export function resolveColumns<T>(
  columns: DynamicTableColumn<T>[],
  maxPriority?: DynamicTablePriority
): ResolvedDynamicTableColumn<T>[] {
  const allowedPriority = maxPriority ?? 5;

  return columns
    .filter((column) => {
      if (column.hidden) return false;
      const priority = clampPriority(column.priority);
      return priority <= allowedPriority;
    })
    .map((column) => {
      const width = column.width ?? column.minWidth ?? DEFAULT_COLUMN_WIDTH;
      return {
        ...column,
        width,
        align: column.align ?? "left",
        priority: clampPriority(column.priority),
      };
    });
}

export function getTotalTableWidth<T>(columns: ResolvedDynamicTableColumn<T>[]): number {
  return columns.reduce((sum, column) => sum + Math.max(column.width, column.minWidth ?? 0), 0);
}

export function getBodyHeight(height: number | string, headerHeight: number): number | string {
  if (typeof height === "number") {
    return Math.max(100, height - headerHeight);
  }
  return `calc(${height} - ${headerHeight}px)`;
}

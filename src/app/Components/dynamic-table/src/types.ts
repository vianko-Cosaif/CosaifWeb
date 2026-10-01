import type { ReactNode } from "react";

export type DynamicTablePriority = 1 | 2 | 3 | 4 | 5;

export type DynamicTableAlign = "left" | "center" | "right";

export type DynamicTableColumn<T> = {
  key: keyof T | string;
  title: ReactNode;
  width?: number;
  minWidth?: number;
  align?: DynamicTableAlign;
  hidden?: boolean;
  priority?: DynamicTablePriority;
  render?: (params: {
    value: unknown;
    row: T;
    rowIndex: number;
    column: DynamicTableColumn<T>;
  }) => ReactNode;
};

export type DynamicTableTheme = {
  backgroundColor: string;
  borderColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  headerBorderColor: string;
  firstColumnHeaderBackgroundColor: string;
  firstColumnBorderColor: string;
  rowBackgroundColor: string;
  alternateRowBackgroundColor: string;
  pressedRowBackgroundColor: string;
  cellTextColor: string;
  cellBorderColor: string;
  emptyTextColor: string;
};

export type DynamicTableProps<T> = {
  data: T[];
  columns: DynamicTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  height?: number | string;
  rowHeight?: number;
  headerHeight?: number;
  emptyText?: string;
  onRowPress?: (row: T, index: number) => void;
  getRowType?: (row: T, index: number) => string | number;
  maxPriority?: DynamicTablePriority;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  theme?: Partial<DynamicTableTheme>;
};

export type ResolvedDynamicTableColumn<T> = DynamicTableColumn<T> & {
  width: number;
  align: DynamicTableAlign;
  priority: DynamicTablePriority;
};

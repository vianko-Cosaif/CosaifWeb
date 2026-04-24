"use client";

import { useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_TABLE_HEIGHT,
  getBodyHeight,
  getTotalTableWidth,
  readCellValue,
  resolveColumns,
  toCellText,
} from "./helpers";
import type { DynamicTableProps } from "./types";

export default function DynamicTable<T>({
  data,
  columns,
  rowKey,
  height = DEFAULT_TABLE_HEIGHT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  emptyText = "Sin datos",
  onRowPress,
  maxPriority,
}: DynamicTableProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const visibleColumns = useMemo(
    () => resolveColumns(columns, maxPriority),
    [columns, maxPriority]
  );

  const totalWidth = useMemo(
    () => getTotalTableWidth(visibleColumns),
    [visibleColumns]
  );

  const bodyHeight = useMemo(
    () => getBodyHeight(height, headerHeight),
    [height, headerHeight]
  );

  const getItemKey = useCallback(
    (index: number) => rowKey(data[index], index),
    [data, rowKey]
  );

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    getItemKey,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div style={{ width: "100%", height, border: "1px solid #dbe4ee", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      <div style={{ width: "100%", overflowX: "auto", overflowY: "hidden", height: "100%" }}>
        <div style={{ minWidth: totalWidth, height: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: headerHeight,
              borderBottom: "1px solid #dbe4ee",
              background: "#f8fafc",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            {visibleColumns.map((column) => (
              <div
                key={String(column.key)}
                style={{
                  width: column.width,
                  minWidth: column.minWidth ?? column.width,
                  padding: "0 10px",
                  textAlign: column.align,
                  borderRight: "1px solid #e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {column.title}
              </div>
            ))}
          </div>

          <div ref={parentRef} style={{ height: bodyHeight, overflowY: "auto", position: "relative" }}>
            {data.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                {emptyText}
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
                {virtualRows.map((virtualRow) => {
                  const row = data[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      role={onRowPress ? "button" : undefined}
                      onClick={onRowPress ? () => onRowPress(row, virtualRow.index) : undefined}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                        display: "flex",
                        alignItems: "center",
                        borderBottom: "1px solid #f1f5f9",
                        background: virtualRow.index % 2 === 0 ? "#ffffff" : "#fcfdff",
                        cursor: onRowPress ? "pointer" : "default",
                      }}
                    >
                      {visibleColumns.map((column) => {
                        const value = readCellValue(row, column.key);
                        const content = column.render
                          ? column.render({ value, row, rowIndex: virtualRow.index, column })
                          : toCellText(value);
                        return (
                          <div
                            key={`${virtualRow.key}:${String(column.key)}`}
                            style={{
                              width: column.width,
                              minWidth: column.minWidth ?? column.width,
                              padding: "0 10px",
                              textAlign: column.align,
                              display: "flex",
                              alignItems: "center",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              borderRight: "1px solid #e2e8f0",
                            }}
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

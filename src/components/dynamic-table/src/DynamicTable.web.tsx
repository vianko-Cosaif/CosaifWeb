"use client";

import { memo, useCallback, useMemo, useRef, type CSSProperties, type UIEvent } from "react";
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
import type { DynamicTableProps, DynamicTableTheme, ResolvedDynamicTableColumn } from "./types";

const DEFAULT_TABLE_THEME: DynamicTableTheme = {
  backgroundColor: "var(--dynamic-table-bg, #ffffff)",
  borderColor: "var(--dynamic-table-border, #dbe4ee)",
  headerBackgroundColor: "var(--dynamic-table-header-bg, #f8fafc)",
  headerTextColor: "var(--dynamic-table-header-text, #334155)",
  headerBorderColor: "var(--dynamic-table-header-border, #dbe4ee)",
  firstColumnHeaderBackgroundColor: "var(--dynamic-table-first-header-bg, #eef2f7)",
  firstColumnBorderColor: "var(--dynamic-table-first-border, #cbd5e1)",
  rowBackgroundColor: "var(--dynamic-table-row-bg, #ffffff)",
  alternateRowBackgroundColor: "var(--dynamic-table-row-alt-bg, #fcfdff)",
  pressedRowBackgroundColor: "var(--dynamic-table-row-pressed-bg, #eef6ff)",
  cellTextColor: "var(--dynamic-table-cell-text, #0f172a)",
  cellBorderColor: "var(--dynamic-table-cell-border, #e2e8f0)",
  emptyTextColor: "var(--dynamic-table-empty-text, #64748b)",
};

const alignItems: Record<string, CSSProperties["justifyContent"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

function cellBaseStyle<T>(
  column: ResolvedDynamicTableColumn<T>,
  theme: DynamicTableTheme
): CSSProperties {
  return {
    width: column.width,
    minWidth: column.minWidth ?? column.width,
    height: "100%",
    padding: "0 10px",
    textAlign: column.align,
    display: "flex",
    alignItems: "center",
    justifyContent: alignItems[column.align],
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    borderRight: `1px solid ${theme.cellBorderColor}`,
  };
}

function DynamicTable<T>({
  data,
  columns,
  rowKey,
  height = DEFAULT_TABLE_HEIGHT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  emptyText = "Sin datos",
  onRowPress,
  maxPriority,
  stickyHeader = true,
  stickyFirstColumn = false,
  theme,
}: DynamicTableProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"header" | "body" | null>(null);

  const tableTheme = useMemo(
    () => ({ ...DEFAULT_TABLE_THEME, ...theme }),
    [theme]
  );

  const visibleColumns = useMemo(
    () => resolveColumns(columns, maxPriority),
    [columns, maxPriority]
  );

  const totalWidth = useMemo(
    () => getTotalTableWidth(visibleColumns),
    [visibleColumns]
  );

  const bodyHeight = useMemo(
    () => stickyHeader ? getBodyHeight(height, headerHeight) : height,
    [height, headerHeight, stickyHeader]
  );

  const columnStyleMap = useMemo(() => {
    const map = new Map<string, CSSProperties>();
    visibleColumns.forEach((column) => {
      map.set(String(column.key), cellBaseStyle(column, tableTheme));
    });
    return map;
  }, [tableTheme, visibleColumns]);

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
  const bodyContentHeight = virtualizer.getTotalSize() + (stickyHeader ? 0 : headerHeight);
  const rowTopOffset = stickyHeader ? 0 : headerHeight;

  const syncHorizontalScroll = useCallback(
    (source: "header" | "body", event: UIEvent<HTMLDivElement>) => {
      if (syncSourceRef.current && syncSourceRef.current !== source) return;
      syncSourceRef.current = source;
      const target = source === "header" ? bodyScrollRef.current : headerScrollRef.current;
      if (target) target.scrollLeft = event.currentTarget.scrollLeft;
      window.requestAnimationFrame(() => {
        syncSourceRef.current = null;
      });
    },
    []
  );

  const renderCellContent = useCallback((
    row: T,
    rowIndex: number,
    column: ResolvedDynamicTableColumn<T>
  ) => {
    const value = readCellValue(row, column.key);
    return column.render
      ? column.render({ value, row, rowIndex, column })
      : toCellText(value);
  }, []);

  const renderHeader = useCallback((targetColumns = visibleColumns, width = totalWidth) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: headerHeight,
        width,
        minWidth: width,
        borderBottom: `1px solid ${tableTheme.headerBorderColor}`,
        background: tableTheme.headerBackgroundColor,
        fontSize: 12,
        fontWeight: 700,
        color: tableTheme.headerTextColor,
      }}
    >
      {targetColumns.map((column) => (
        <div
          key={String(column.key)}
          style={columnStyleMap.get(String(column.key))}
        >
          {column.title}
        </div>
      ))}
    </div>
  ), [columnStyleMap, headerHeight, tableTheme.headerBackgroundColor, tableTheme.headerBorderColor, tableTheme.headerTextColor, totalWidth, visibleColumns]);

  const renderEmptyState = useCallback(() => (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tableTheme.emptyTextColor,
        fontSize: 14,
      }}
    >
      {emptyText}
    </div>
  ), [emptyText, tableTheme.emptyTextColor]);

  const renderFrozenTable = () => {
    const [firstColumn, ...scrollColumns] = visibleColumns;
    if (!firstColumn) return renderEmptyState();

    const firstColumnWidth = firstColumn.width;
    const scrollWidth = getTotalTableWidth(scrollColumns);

    return (
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          height,
          boxSizing: "border-box",
          contain: "inline-size",
          border: `1px solid ${tableTheme.borderColor}`,
          borderRadius: 10,
          overflow: "hidden",
          background: tableTheme.backgroundColor,
        }}
      >
        {stickyHeader ? (
          <div style={{ display: "flex", height: headerHeight }}>
            <div
              style={{
                ...cellBaseStyle(firstColumn, tableTheme),
                width: firstColumnWidth,
                minWidth: firstColumnWidth,
                background: tableTheme.firstColumnHeaderBackgroundColor,
                borderRight: `1px solid ${tableTheme.firstColumnBorderColor}`,
                borderBottom: `1px solid ${tableTheme.headerBorderColor}`,
                color: tableTheme.headerTextColor,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {firstColumn.title}
            </div>
            <div
              ref={headerScrollRef}
              onScroll={(event) => syncHorizontalScroll("header", event)}
              style={{
                flex: 1,
                minWidth: 0,
                overflowX: "auto",
                overflowY: "hidden",
                overscrollBehaviorX: "contain",
                touchAction: "pan-x",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
              }}
            >
              {renderHeader(scrollColumns, scrollWidth)}
            </div>
          </div>
        ) : null}

        <div
          ref={parentRef}
          style={{
            height: bodyHeight,
            width: "100%",
            minWidth: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            position: "relative",
          }}
        >
          {data.length === 0 ? (
            renderEmptyState()
          ) : (
            <div style={{ height: bodyContentHeight, width: "100%", minWidth: 0, position: "relative", display: "flex" }}>
              <div
                style={{
                  width: firstColumnWidth,
                  minWidth: firstColumnWidth,
                  position: "relative",
                  zIndex: 2,
                  borderRight: `1px solid ${tableTheme.firstColumnBorderColor}`,
                  background: tableTheme.backgroundColor,
                }}
              >
                {!stickyHeader ? (
                  <div
                    style={{
                      ...cellBaseStyle(firstColumn, tableTheme),
                      height: headerHeight,
                      background: tableTheme.firstColumnHeaderBackgroundColor,
                      color: tableTheme.headerTextColor,
                      fontSize: 12,
                      fontWeight: 700,
                      borderBottom: `1px solid ${tableTheme.headerBorderColor}`,
                    }}
                  >
                    {firstColumn.title}
                  </div>
                ) : null}
                {virtualRows.map((virtualRow) => {
                  const row = data[virtualRow.index];
                  const rowBackground = virtualRow.index % 2 === 0
                    ? tableTheme.rowBackgroundColor
                    : tableTheme.alternateRowBackgroundColor;

                  return (
                    <div
                      key={`${virtualRow.key}:frozen`}
                      role={onRowPress ? "button" : undefined}
                      onClick={onRowPress ? () => onRowPress(row, virtualRow.index) : undefined}
                      style={{
                        position: "absolute",
                        top: virtualRow.start + rowTopOffset,
                        left: 0,
                        width: firstColumnWidth,
                        height: virtualRow.size,
                        display: "flex",
                        alignItems: "center",
                        borderBottom: `1px solid ${tableTheme.cellBorderColor}`,
                        background: rowBackground,
                        color: tableTheme.cellTextColor,
                        cursor: onRowPress ? "pointer" : "default",
                      }}
                    >
                      <div style={{ ...columnStyleMap.get(String(firstColumn.key)), borderRight: 0 }}>
                        {renderCellContent(row, virtualRow.index, firstColumn)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                ref={bodyScrollRef}
                onScroll={(event) => syncHorizontalScroll("body", event)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowX: "auto",
                  overflowY: "hidden",
                  overscrollBehaviorX: "contain",
                  touchAction: "pan-x",
                  WebkitOverflowScrolling: "touch",
                  position: "relative",
                }}
              >
                <div style={{ width: scrollWidth, height: bodyContentHeight, position: "relative" }}>
                  {!stickyHeader ? renderHeader(scrollColumns, scrollWidth) : null}
                  {virtualRows.map((virtualRow) => {
                    const row = data[virtualRow.index];
                    const rowBackground = virtualRow.index % 2 === 0
                      ? tableTheme.rowBackgroundColor
                      : tableTheme.alternateRowBackgroundColor;

                    return (
                      <div
                        key={`${virtualRow.key}:scroll`}
                        role={onRowPress ? "button" : undefined}
                        onClick={onRowPress ? () => onRowPress(row, virtualRow.index) : undefined}
                        style={{
                          position: "absolute",
                          top: virtualRow.start + rowTopOffset,
                          left: 0,
                          width: scrollWidth,
                          height: virtualRow.size,
                          display: "flex",
                          alignItems: "center",
                          borderBottom: `1px solid ${tableTheme.cellBorderColor}`,
                          background: rowBackground,
                          color: tableTheme.cellTextColor,
                          cursor: onRowPress ? "pointer" : "default",
                        }}
                      >
                        {scrollColumns.map((column) => (
                          <div key={`${virtualRow.key}:${String(column.key)}`} style={columnStyleMap.get(String(column.key))}>
                            {renderCellContent(row, virtualRow.index, column)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (stickyFirstColumn) {
    return renderFrozenTable();
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height,
        boxSizing: "border-box",
        contain: "inline-size",
        border: `1px solid ${tableTheme.borderColor}`,
        borderRadius: 10,
        overflow: "hidden",
        background: tableTheme.backgroundColor,
      }}
    >
      <div
        style={{
          width: "100%",
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          overscrollBehaviorX: "contain",
          touchAction: "pan-x",
          WebkitOverflowScrolling: "touch",
          height: "100%",
        }}
      >
        <div style={{ minWidth: totalWidth, height: "100%" }}>
          {stickyHeader ? renderHeader() : null}

          <div
            ref={parentRef}
            style={{
              height: bodyHeight,
              overflowY: "auto",
              overscrollBehavior: "contain",
              position: "relative",
            }}
          >
            {data.length === 0 ? (
              renderEmptyState()
            ) : (
              <div style={{ height: bodyContentHeight, width: totalWidth, position: "relative" }}>
                {!stickyHeader ? renderHeader() : null}
                {virtualRows.map((virtualRow) => {
                  const row = data[virtualRow.index];
                  const rowBackground = virtualRow.index % 2 === 0
                    ? tableTheme.rowBackgroundColor
                    : tableTheme.alternateRowBackgroundColor;

                  return (
                    <div
                      key={virtualRow.key}
                      role={onRowPress ? "button" : undefined}
                      onClick={onRowPress ? () => onRowPress(row, virtualRow.index) : undefined}
                      style={{
                        position: "absolute",
                        top: virtualRow.start + rowTopOffset,
                        left: 0,
                        width: totalWidth,
                        height: virtualRow.size,
                        display: "flex",
                        alignItems: "center",
                        borderBottom: `1px solid ${tableTheme.cellBorderColor}`,
                        background: rowBackground,
                        color: tableTheme.cellTextColor,
                        cursor: onRowPress ? "pointer" : "default",
                      }}
                    >
                      {visibleColumns.map((column) => (
                        <div key={`${virtualRow.key}:${String(column.key)}`} style={columnStyleMap.get(String(column.key))}>
                          {renderCellContent(row, virtualRow.index, column)}
                        </div>
                      ))}
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

export default memo(DynamicTable) as typeof DynamicTable;

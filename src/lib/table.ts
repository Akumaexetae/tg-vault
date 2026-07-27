/**
 * Table data lives in the object's `text` column as JSON, so tables need no
 * schema of their own and every existing sync, undo and delete path works on
 * them unchanged.
 */
export interface TableData {
  cells: string[][]; // [row][col]
}

export const DEFAULT_ROWS = 3;
export const DEFAULT_COLS = 3;
export const MAX_ROWS = 50;
export const MAX_COLS = 20;

export function emptyTable(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): TableData {
  return {
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
  };
}

/** Never throws: a malformed or legacy value yields an empty table. */
export function parseTable(raw: string): TableData {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as TableData).cells)
    ) {
      const cells = (parsed as TableData).cells
        .filter(Array.isArray)
        .map((row) => row.map((c) => (typeof c === 'string' ? c : String(c ?? ''))));
      return cells.length > 0 ? { cells: squareOff(cells) } : emptyTable();
    }
  } catch {
    /* fall through */
  }
  return emptyTable();
}

/** Pads short rows so every row has the same length as the longest. */
function squareOff(cells: string[][]): string[][] {
  const width = Math.max(...cells.map((r) => r.length), 1);
  return cells.map((row) => [...row, ...Array(width - row.length).fill('')]);
}

export const serializeTable = (table: TableData): string => JSON.stringify(table);

export function setCell(
  table: TableData,
  row: number,
  col: number,
  value: string,
): TableData {
  return {
    cells: table.cells.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r,
    ),
  };
}

export function addRow(table: TableData, at?: number): TableData {
  if (table.cells.length >= MAX_ROWS) return table;
  const width = table.cells[0]?.length ?? DEFAULT_COLS;
  const blank = Array.from({ length: width }, () => '');
  const index = at ?? table.cells.length;
  const cells = [...table.cells];
  cells.splice(index, 0, blank);
  return { cells };
}

export function addColumn(table: TableData, at?: number): TableData {
  const width = table.cells[0]?.length ?? 0;
  if (width >= MAX_COLS) return table;
  const index = at ?? width;
  return {
    cells: table.cells.map((row) => {
      const next = [...row];
      next.splice(index, 0, '');
      return next;
    }),
  };
}

/** Removing the last row or column is refused — an empty table can't be edited. */
export function removeRow(table: TableData, at: number): TableData {
  if (table.cells.length <= 1) return table;
  return { cells: table.cells.filter((_, i) => i !== at) };
}

export function removeColumn(table: TableData, at: number): TableData {
  if ((table.cells[0]?.length ?? 0) <= 1) return table;
  return { cells: table.cells.map((row) => row.filter((_, i) => i !== at)) };
}

/** Tab-separated text, so a table can be pasted straight into a spreadsheet. */
export const tableToTsv = (table: TableData): string =>
  table.cells.map((row) => row.join('\t')).join('\n');

/** Reads text pasted in from a spreadsheet. */
export function tsvToTable(text: string): TableData {
  const rows = text.replace(/\r/g, '').split('\n').filter((r) => r !== '');
  if (rows.length === 0) return emptyTable();
  return { cells: squareOff(rows.map((r) => r.split('\t'))) };
}

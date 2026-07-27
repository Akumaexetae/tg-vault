import { describe, expect, it } from 'vitest';
import {
  MAX_COLS,
  MAX_ROWS,
  addColumn,
  addRow,
  emptyTable,
  parseTable,
  removeColumn,
  removeRow,
  serializeTable,
  setCell,
  tableToTsv,
  tsvToTable,
} from './table';

describe('emptyTable', () => {
  it('creates a 3×3 grid of blanks by default', () => {
    const t = emptyTable();
    expect(t.cells).toHaveLength(3);
    expect(t.cells[0]).toEqual(['', '', '']);
  });
});

describe('parseTable', () => {
  it('round-trips through serialize', () => {
    const t = setCell(emptyTable(), 1, 2, 'hello');
    expect(parseTable(serializeTable(t))).toEqual(t);
  });

  it('never throws on rubbish, returning an empty table instead', () => {
    expect(parseTable('')).toEqual(emptyTable());
    expect(parseTable('not json')).toEqual(emptyTable());
    expect(parseTable('{"cells":"nope"}')).toEqual(emptyTable());
    expect(parseTable('null')).toEqual(emptyTable());
  });

  it('pads ragged rows so the grid stays rectangular', () => {
    const parsed = parseTable('{"cells":[["a","b","c"],["d"]]}');
    expect(parsed.cells[1]).toEqual(['d', '', '']);
  });

  it('coerces non-string cells rather than dropping them', () => {
    expect(parseTable('{"cells":[[1,true]]}').cells[0]).toEqual(['1', 'true']);
  });
});

describe('setCell', () => {
  it('changes one cell without touching the rest', () => {
    const t = setCell(emptyTable(), 0, 1, 'x');
    expect(t.cells[0]).toEqual(['', 'x', '']);
    expect(t.cells[1]).toEqual(['', '', '']);
  });

  it('does not mutate the original', () => {
    const original = emptyTable();
    setCell(original, 0, 0, 'x');
    expect(original.cells[0][0]).toBe('');
  });
});

describe('addRow / addColumn', () => {
  it('appends by default', () => {
    expect(addRow(emptyTable()).cells).toHaveLength(4);
    expect(addColumn(emptyTable()).cells[0]).toHaveLength(4);
  });

  it('inserts at a position', () => {
    const t = setCell(emptyTable(), 0, 0, 'first');
    expect(addRow(t, 0).cells[1][0]).toBe('first');
    expect(addColumn(t, 0).cells[0][1]).toBe('first');
  });

  it('refuses to grow past the limits', () => {
    let t = emptyTable(MAX_ROWS, 2);
    expect(addRow(t).cells).toHaveLength(MAX_ROWS);
    t = emptyTable(2, MAX_COLS);
    expect(addColumn(t).cells[0]).toHaveLength(MAX_COLS);
  });
});

describe('removeRow / removeColumn', () => {
  it('removes at a position', () => {
    const t = setCell(emptyTable(), 1, 0, 'gone');
    expect(removeRow(t, 1).cells).toHaveLength(2);
    expect(removeRow(t, 1).cells.every((r) => r[0] !== 'gone')).toBe(true);
  });

  it('never empties the table completely', () => {
    const single = emptyTable(1, 1);
    expect(removeRow(single, 0)).toEqual(single);
    expect(removeColumn(single, 0)).toEqual(single);
  });
});

describe('TSV round-trip', () => {
  it('exports tab-separated rows for pasting into a spreadsheet', () => {
    const t = { cells: [['a', 'b'], ['c', 'd']] };
    expect(tableToTsv(t)).toBe('a\tb\nc\td');
  });

  it('imports pasted spreadsheet text', () => {
    expect(tsvToTable('a\tb\nc\td').cells).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('squares off ragged pasted data', () => {
    expect(tsvToTable('a\tb\tc\nd').cells[1]).toEqual(['d', '', '']);
  });

  it('survives Windows line endings and a trailing newline', () => {
    expect(tsvToTable('a\tb\r\nc\td\r\n').cells).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

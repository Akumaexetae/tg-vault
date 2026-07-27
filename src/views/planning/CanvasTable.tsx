import { useState } from 'react';
import {
  addColumn,
  addRow,
  parseTable,
  removeColumn,
  removeRow,
  serializeTable,
  setCell,
  type TableData,
} from '../../lib/table';

interface Props {
  raw: string;
  zoom: number;
  editable: boolean;
  selected: boolean;
  onChange: (serialized: string) => void;
}

/**
 * A table stored as JSON inside the object's `text` field, so it needs no
 * schema of its own and inherits sync, undo and delete for free.
 */
export function CanvasTable({ raw, zoom, editable, selected, onChange }: Props) {
  const table = parseTable(raw);
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null);

  const apply = (next: TableData) => onChange(serializeTable(next));

  return (
    <div className="canvas-table-wrap">
      <table className="canvas-table" style={{ fontSize: `${12 * zoom}px` }}>
        <tbody>
          {table.cells.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    focus?.row === ri && focus.col === ci ? 'canvas-cell-focus' : ''
                  }
                >
                  <input
                    className="canvas-cell"
                    value={cell}
                    readOnly={!editable}
                    onFocus={() => setFocus({ row: ri, col: ci })}
                    onBlur={() => setFocus(null)}
                    onChange={(e) => apply(setCell(table, ri, ci, e.target.value))}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {selected && editable && (
        <div className="canvas-table-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button className="btn btn-tiny" onClick={() => apply(addRow(table))}>
            + Row
          </button>
          <button className="btn btn-tiny" onClick={() => apply(addColumn(table))}>
            + Col
          </button>
          <button
            className="btn btn-tiny"
            disabled={table.cells.length <= 1}
            onClick={() => apply(removeRow(table, table.cells.length - 1))}
          >
            − Row
          </button>
          <button
            className="btn btn-tiny"
            disabled={(table.cells[0]?.length ?? 0) <= 1}
            onClick={() =>
              apply(removeColumn(table, (table.cells[0]?.length ?? 1) - 1))
            }
          >
            − Col
          </button>
        </div>
      )}
    </div>
  );
}

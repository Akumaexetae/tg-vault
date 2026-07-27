import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  NOTE_COLORS,
  fitToObjects,
  nextZ,
  objectAt,
  objectBounds,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from '../../lib/canvas';
import {
  canRedo,
  canUndo,
  emptyHistory,
  pushCoalesced,
  push as pushStep,
  redo,
  undo,
  type History,
  type Step,
} from '../../lib/history';
import {
  createCanvas,
  createObject,
  deleteCanvas,
  deleteObject,
  updateObject,
} from '../../lib/queries';
import { emptyTable, serializeTable } from '../../lib/table';
import type { CanvasObject, CanvasObjectKind, User } from '../../lib/types';
import { CanvasTable } from './CanvasTable';

interface Props {
  user: User;
  readOnly: boolean;
  onToast: (message: string, kind?: 'ok' | 'error') => void;
}

type Drag =
  | { mode: 'pan'; startX: number; startY: number; origin: Viewport }
  | { mode: 'marquee'; startX: number; startY: number; x: number; y: number }
  | { mode: 'move'; ids: string[]; dx: number; dy: number; before: CanvasObject[] }
  | { mode: 'resize'; id: string; startW: number; startH: number; startX: number; startY: number; before: CanvasObject[] }
  | { mode: 'arrow'; id: string; before: CanvasObject[] }
  | null;

const SHAPES: { kind: CanvasObjectKind; label: string }[] = [
  { kind: 'note', label: 'Note' },
  { kind: 'text', label: 'Text' },
  { kind: 'box', label: 'Box' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'table', label: 'Table' },
];

const DEFAULTS: Record<string, { w: number; h: number; color: string }> = {
  note: { w: 180, h: 130, color: NOTE_COLORS[0] },
  text: { w: 220, h: 40, color: '#17303d' },
  box: { w: 260, h: 180, color: '#00aff0' },
  ellipse: { w: 200, h: 160, color: '#16a085' },
  diamond: { w: 190, h: 160, color: '#e67e22' },
  arrow: { w: 0, h: 0, color: '#5b7585' },
  table: { w: 340, h: 140, color: '#ffffff' },
  image: { w: 240, h: 180, color: '#ffffff' },
};

const COALESCE_MS = 700;

export function CanvasView({ user, readOnly, onToast }: Props) {
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const {
    canvases,
    objects,
    cursors,
    reloadCanvases,
    reloadObjects,
    sendCursor,
    patchLocal,
  } = useCanvas(canvasId, user);

  const surface = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport>({ x: -400, y: -300, zoom: 1 });
  const [drag, setDrag] = useState<Drag>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory());
  const clipboard = useRef<CanvasObject[]>([]);
  const lastCursorSend = useRef(0);
  const lastStepAt = useRef(0);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  useEffect(() => {
    if (canvasId || canvases.length === 0) return;
    setCanvasId(canvases[0].id);
  }, [canvases, canvasId]);

  // A different board is a different history; keeping it would let undo
  // resurrect objects onto a canvas they never belonged to.
  useEffect(() => {
    setHistory(emptyHistory());
    setSelected([]);
  }, [canvasId]);

  const rect = () => surface.current?.getBoundingClientRect();
  const toWorld = (clientX: number, clientY: number) => {
    const r = rect();
    if (!r) return { x: 0, y: 0 };
    return screenToWorld(clientX - r.left, clientY - r.top, view);
  };

  const record = useCallback((step: Step, coalesce = false) => {
    const now = Date.now();
    setHistory((h) =>
      coalesce
        ? pushCoalesced(h, step, COALESCE_MS, now, lastStepAt.current)
        : pushStep(h, step),
    );
    lastStepAt.current = now;
  }, []);

  // --- Applying a step in either direction -----------------------------
  const applyStep = async (step: Step) => {
    try {
      if (step.kind === 'delete') {
        await Promise.all(step.objects.map((o) => deleteObject(o.id)));
      } else if (step.kind === 'create') {
        // Re-create with the original id so a later undo still matches.
        await Promise.all(
          step.objects.map((o) =>
            createObject(
              {
                canvas_id: o.canvas_id,
                kind: o.kind,
                x: o.x,
                y: o.y,
                w: o.w,
                h: o.h,
                x2: o.x2,
                y2: o.y2,
                text: o.text,
                color: o.color,
                z: o.z,
              },
              user,
            ),
          ),
        );
      } else {
        await Promise.all(
          step.after.map((o) =>
            updateObject(
              o.id,
              { x: o.x, y: o.y, w: o.w, h: o.h, x2: o.x2, y2: o.y2, text: o.text, color: o.color, z: o.z },
              user,
            ),
          ),
        );
      }
      await reloadObjects();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not apply that', 'error');
      await reloadObjects();
    }
  };

  const doUndo = async () => {
    const result = undo(history);
    if (!result) return;
    setHistory(result.history);
    setSelected([]);
    await applyStep(result.step);
  };

  const doRedo = async () => {
    const result = redo(history);
    if (!result) return;
    setHistory(result.history);
    setSelected([]);
    await applyStep(result.step);
  };

  // --- Object operations -----------------------------------------------
  const addObject = async (kind: CanvasObjectKind) => {
    if (!canvasId) return;
    const r = rect();
    const centre = r ? screenToWorld(r.width / 2, r.height / 2, view) : { x: 0, y: 0 };
    const d = DEFAULTS[kind];
    try {
      const created = await createObject(
        {
          canvas_id: canvasId,
          kind,
          x: Math.round(centre.x - d.w / 2),
          y: Math.round(centre.y - d.h / 2),
          w: d.w,
          h: d.h,
          x2: kind === 'arrow' ? Math.round(centre.x + 160) : null,
          y2: kind === 'arrow' ? Math.round(centre.y) : null,
          text: kind === 'table' ? serializeTable(emptyTable()) : '',
          color: d.color,
          z: nextZ(objects),
        },
        user,
      );
      record({ kind: 'create', objects: [created] });
      await reloadObjects();
      setSelected([created.id]);
      if (kind !== 'arrow' && kind !== 'table') setEditing(created.id);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not add that', 'error');
    }
  };

  const commit = async (
    id: string,
    patch: Partial<CanvasObject>,
    options: { history?: boolean; coalesce?: boolean } = {},
  ) => {
    const before = objectsRef.current.find((o) => o.id === id);
    patchLocal(id, patch);
    if (options.history !== false && before) {
      record(
        { kind: 'update', before: [before], after: [{ ...before, ...patch }] },
        options.coalesce,
      );
    }
    try {
      await updateObject(id, patch, user);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Change not saved', 'error');
      await reloadObjects();
    }
  };

  const removeSelected = async () => {
    if (selected.length === 0) return;
    const doomed = objects.filter((o) => selected.includes(o.id));
    setSelected([]);
    setEditing(null);
    record({ kind: 'delete', objects: doomed });
    try {
      await Promise.all(doomed.map((o) => deleteObject(o.id)));
      await reloadObjects();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const duplicate = async (sources: CanvasObject[], offset = 24) => {
    if (!canvasId || sources.length === 0) return;
    try {
      const made: CanvasObject[] = [];
      let z = nextZ(objects);
      for (const o of sources) {
        made.push(
          await createObject(
            {
              canvas_id: canvasId,
              kind: o.kind,
              x: o.x + offset,
              y: o.y + offset,
              w: o.w,
              h: o.h,
              x2: o.x2 === null ? null : o.x2 + offset,
              y2: o.y2 === null ? null : o.y2 + offset,
              text: o.text,
              color: o.color,
              z: z++,
            },
            user,
          ),
        );
      }
      record({ kind: 'create', objects: made });
      await reloadObjects();
      setSelected(made.map((o) => o.id));
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not duplicate', 'error');
    }
  };

  // --- Pointer handling ------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    const world = toWorld(e.clientX, e.clientY);
    const hit = objectAt(objects, world.x, world.y);

    if (!hit) {
      if (e.shiftKey) {
        setDrag({ mode: 'marquee', startX: world.x, startY: world.y, x: world.x, y: world.y });
      } else {
        setSelected([]);
        setDrag({ mode: 'pan', startX: e.clientX, startY: e.clientY, origin: view });
      }
      return;
    }
    if (readOnly) return;

    const next = e.shiftKey
      ? selected.includes(hit.id)
        ? selected.filter((id) => id !== hit.id)
        : [...selected, hit.id]
      : selected.includes(hit.id)
        ? selected
        : [hit.id];
    setSelected(next);

    const moving = objects.filter((o) => next.includes(o.id));
    setDrag({
      mode: 'move',
      ids: next,
      dx: world.x - hit.x,
      dy: world.y - hit.y,
      before: moving.map((o) => ({ ...o })),
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const world = toWorld(e.clientX, e.clientY);

    const now = Date.now();
    if (now - lastCursorSend.current > 50) {
      lastCursorSend.current = now;
      sendCursor(world.x, world.y);
    }
    if (!drag) return;

    if (drag.mode === 'pan') {
      setView({
        ...drag.origin,
        x: drag.origin.x - (e.clientX - drag.startX) / drag.origin.zoom,
        y: drag.origin.y - (e.clientY - drag.startY) / drag.origin.zoom,
      });
    } else if (drag.mode === 'marquee') {
      setDrag({ ...drag, x: world.x, y: world.y });
    } else if (drag.mode === 'move') {
      const anchor = drag.before.find((o) => o.id === drag.ids[0]);
      if (!anchor) return;
      const targetX = Math.round(world.x - drag.dx);
      const targetY = Math.round(world.y - drag.dy);
      const shiftX = targetX - anchor.x;
      const shiftY = targetY - anchor.y;
      for (const o of drag.before) {
        patchLocal(o.id, {
          x: o.x + shiftX,
          y: o.y + shiftY,
          x2: o.x2 === null ? null : o.x2 + shiftX,
          y2: o.y2 === null ? null : o.y2 + shiftY,
        });
      }
    } else if (drag.mode === 'resize') {
      patchLocal(drag.id, {
        w: Math.max(60, Math.round(drag.startW + (world.x - drag.startX))),
        h: Math.max(40, Math.round(drag.startH + (world.y - drag.startY))),
      });
    } else if (drag.mode === 'arrow') {
      patchLocal(drag.id, { x2: Math.round(world.x), y2: Math.round(world.y) });
    }
  };

  const onPointerUp = async () => {
    if (!drag) return;
    const current = drag;
    setDrag(null);

    if (current.mode === 'pan') return;

    if (current.mode === 'marquee') {
      const x1 = Math.min(current.startX, current.x);
      const x2 = Math.max(current.startX, current.x);
      const y1 = Math.min(current.startY, current.y);
      const y2 = Math.max(current.startY, current.y);
      setSelected(
        objects
          .filter((o) => {
            const b = objectBounds(o);
            return b.x < x2 && b.x + b.w > x1 && b.y < y2 && b.y + b.h > y1;
          })
          .map((o) => o.id),
      );
      return;
    }

    const after = objectsRef.current.filter((o) =>
      current.mode === 'move' ? current.ids.includes(o.id) : o.id === current.id,
    );
    if (after.length === 0) return;
    // Nothing actually moved — don't clutter the undo stack.
    const changed = after.some((a) => {
      const b = current.before.find((o) => o.id === a.id);
      return !b || b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h || b.x2 !== a.x2 || b.y2 !== a.y2;
    });
    if (!changed) return;

    record({ kind: 'update', before: current.before, after: after.map((o) => ({ ...o })) });
    try {
      await Promise.all(
        after.map((o) =>
          updateObject(o.id, { x: o.x, y: o.y, w: o.w, h: o.h, x2: o.x2, y2: o.y2 }, user),
        ),
      );
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Move not saved', 'error');
      await reloadObjects();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = rect();
    if (!r) return;
    setView((v) =>
      zoomAt(v, e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12),
    );
  };

  // --- Keyboard ---------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        editing !== null ||
        (e.target instanceof HTMLElement &&
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        doRedo();
        return;
      }
      if (typing || readOnly) return;

      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate(objects.filter((o) => selected.includes(o.id)));
      } else if (mod && e.key.toLowerCase() === 'c') {
        clipboard.current = objects.filter((o) => selected.includes(o.id));
      } else if (mod && e.key.toLowerCase() === 'v') {
        duplicate(clipboard.current, 32);
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(objects.map((o) => o.id));
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === 'Escape') {
        setSelected([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const zoomToFit = () => {
    const r = rect();
    if (r) setView(fitToObjects(objects, r.width, r.height));
  };

  const newCanvas = async () => {
    try {
      const created = await createCanvas(`Board ${canvases.length + 1}`, user);
      await reloadCanvases();
      setCanvasId(created.id);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not create board', 'error');
    }
  };

  const removeCanvas = async () => {
    const current = canvases.find((c) => c.id === canvasId);
    if (!current) return;
    try {
      await deleteCanvas(current.id, user, current.name);
      setCanvasId(null);
      await reloadCanvases();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not delete board', 'error');
    }
  };

  const selectedObjects = objects.filter((o) => selected.includes(o.id));
  const colourable = selectedObjects.filter((o) => o.kind !== 'arrow' && o.kind !== 'table');

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <select
          className="input input-small"
          value={canvasId ?? ''}
          onChange={(e) => setCanvasId(e.target.value || null)}
        >
          {canvases.length === 0 && <option value="">No boards yet</option>}
          {canvases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-tiny" disabled={readOnly} onClick={newCanvas}>
          + Board
        </button>

        <span className="canvas-divider" />

        {SHAPES.map((s) => (
          <button
            key={s.kind}
            className="btn btn-tiny"
            disabled={readOnly || !canvasId}
            onClick={() => addObject(s.kind)}
          >
            {s.label}
          </button>
        ))}

        <span className="canvas-divider" />

        <button
          className="btn btn-tiny"
          disabled={!canUndo(history)}
          title="Undo (Ctrl+Z)"
          onClick={doUndo}
        >
          Undo
        </button>
        <button
          className="btn btn-tiny"
          disabled={!canRedo(history)}
          title="Redo (Ctrl+Shift+Z)"
          onClick={doRedo}
        >
          Redo
        </button>

        {colourable.length > 0 && (
          <>
            <span className="canvas-divider" />
            <span className="canvas-colors">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`canvas-swatch ${
                    colourable.every((o) => o.color === c) ? 'canvas-swatch-on' : ''
                  }`}
                  style={{ background: c }}
                  title="Colour"
                  onClick={() => colourable.forEach((o) => commit(o.id, { color: c }))}
                />
              ))}
            </span>
          </>
        )}
        {selectedObjects.length > 0 && (
          <>
            <button
              className="btn btn-tiny"
              onClick={() => duplicate(selectedObjects)}
              title="Duplicate (Ctrl+D)"
            >
              Duplicate
            </button>
            <button className="btn btn-tiny btn-danger" onClick={removeSelected}>
              Delete{selectedObjects.length > 1 ? ` ${selectedObjects.length}` : ''}
            </button>
          </>
        )}

        <span className="canvas-toolbar-right">
          {Object.values(cursors).map((c) => (
            <span
              key={c.who}
              className={`activity-avatar avatar-${c.who.toLowerCase()} canvas-who`}
            >
              {c.who[0]}
            </span>
          ))}
          <button className="btn btn-tiny" onClick={zoomToFit}>
            Fit
          </button>
          <span className="canvas-zoom">{Math.round(view.zoom * 100)}%</span>
          {canvasId && (
            <button className="btn btn-tiny" disabled={readOnly} onClick={removeCanvas}>
              Delete board
            </button>
          )}
        </span>
      </div>

      <div className="canvas-hint">
        Drag to pan · scroll to zoom · <strong>Shift+drag</strong> to select several ·
        double-click to write · Ctrl+Z undo · Ctrl+D duplicate
      </div>

      <div
        ref={surface}
        className={`canvas-surface ${drag?.mode === 'pan' ? 'canvas-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${-view.x * view.zoom}px ${-view.y * view.zoom}px`,
        }}
      >
        {canvases.length === 0 && (
          <div className="canvas-empty">
            <p>No boards yet.</p>
            <button className="btn btn-primary" disabled={readOnly} onClick={newCanvas}>
              Create one
            </button>
          </div>
        )}

        {drag?.mode === 'marquee' &&
          (() => {
            const a = worldToScreen(
              Math.min(drag.startX, drag.x),
              Math.min(drag.startY, drag.y),
              view,
            );
            const b = worldToScreen(
              Math.max(drag.startX, drag.x),
              Math.max(drag.startY, drag.y),
              view,
            );
            return (
              <div
                className="canvas-marquee"
                style={{ left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y }}
              />
            );
          })()}

        {objects.map((o) => {
          const p = worldToScreen(o.x, o.y, view);
          const isSelected = selected.includes(o.id);

          if (o.kind === 'arrow') {
            const end = worldToScreen(o.x2 ?? o.x, o.y2 ?? o.y, view);
            return (
              <svg key={o.id} className="canvas-arrow" aria-hidden="true">
                <defs>
                  <marker
                    id={`head-${o.id}`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 z" fill={o.color} />
                  </marker>
                </defs>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={o.color}
                  strokeWidth={isSelected ? 3 : 2}
                  markerEnd={`url(#head-${o.id})`}
                />
                {isSelected && !readOnly && (
                  <circle
                    className="canvas-arrow-handle"
                    cx={end.x}
                    cy={end.y}
                    r="6"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDrag({ mode: 'arrow', id: o.id, before: [{ ...o }] });
                    }}
                  />
                )}
              </svg>
            );
          }

          const shapeStyle: React.CSSProperties = {
            left: p.x,
            top: p.y,
            width: o.w * view.zoom,
            height: o.h * view.zoom,
            fontSize: `${(o.kind === 'text' ? 18 : 13) * view.zoom}px`,
          };
          if (o.kind === 'note') shapeStyle.background = o.color;
          if (o.kind === 'box' || o.kind === 'ellipse' || o.kind === 'diamond') {
            shapeStyle.borderColor = o.color;
          }
          if (o.kind === 'text') shapeStyle.color = o.color;

          return (
            <div
              key={o.id}
              className={`canvas-object canvas-${o.kind} ${isSelected ? 'canvas-selected' : ''}`}
              style={shapeStyle}
              onDoubleClick={() => !readOnly && o.kind !== 'table' && setEditing(o.id)}
            >
              {o.kind === 'table' ? (
                <CanvasTable
                  raw={o.text}
                  zoom={view.zoom}
                  editable={!readOnly}
                  selected={isSelected}
                  onChange={(next) => commit(o.id, { text: next }, { coalesce: true })}
                />
              ) : editing === o.id ? (
                <textarea
                  className="canvas-text-input"
                  defaultValue={o.text}
                  autoFocus
                  onBlur={(e) => {
                    setEditing(null);
                    if (e.target.value !== o.text) commit(o.id, { text: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                  }}
                />
              ) : (
                <span className="canvas-object-text">
                  {o.text || <em className="canvas-placeholder">Double-click to write</em>}
                </span>
              )}

              {isSelected && !readOnly && selected.length === 1 && (
                <span
                  className="canvas-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const world = toWorld(e.clientX, e.clientY);
                    setDrag({
                      mode: 'resize',
                      id: o.id,
                      startW: o.w,
                      startH: o.h,
                      startX: world.x,
                      startY: world.y,
                      before: [{ ...o }],
                    });
                  }}
                />
              )}
            </div>
          );
        })}

        {Object.values(cursors).map((c) => {
          const p = worldToScreen(c.x, c.y, view);
          return (
            <div key={c.who} className="canvas-cursor" style={{ left: p.x, top: p.y }}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path
                  d="M1 1 L1 12 L4.5 9 L7 14 L9.5 13 L7 8 L11.5 8 z"
                  fill={c.who === 'Tyler' ? '#00aff0' : '#8e44ad'}
                  stroke="#fff"
                  strokeWidth="1"
                />
              </svg>
              <span
                className="canvas-cursor-name"
                style={{ background: c.who === 'Tyler' ? '#00aff0' : '#8e44ad' }}
              >
                {c.who}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { CreatorAvatar } from '../../components/CreatorAvatar';
import { LANES, cardsInLane, overdueCards } from '../../lib/board';
import type { BoardCard, Creator, Lane, VaultData } from '../../lib/types';

interface Props {
  data: VaultData;
  readOnly: boolean;
  onAdd: (lane: Lane) => void;
  onEdit: (card: BoardCard) => void;
  onMove: (card: BoardCard, lane: Lane, index: number) => void;
}

interface DropTarget {
  lane: Lane;
  index: number;
}

export function BoardView({ data, readOnly, onAdd, onEdit, onMove }: Props) {
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = new Set(overdueCards(data.cards, today).map((c) => c.id));
  const creatorById = new Map(data.creators.map((c) => [c.id, c]));

  const drop = (lane: Lane, index: number) => {
    if (dragging) onMove(dragging, lane, index);
    setDragging(null);
    setTarget(null);
  };

  const isTarget = (lane: Lane, index: number) =>
    target?.lane === lane && target.index === index;

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1>Planning</h1>
          <p className="muted">
            Shared with {data.creators.length ? 'Gabriel' : 'your partner'} — moves
            appear on both screens.
          </p>
        </div>
      </div>

      <div className="board">
        {LANES.map(({ key, label }) => {
          const column = cardsInLane(data.cards, key);
          return (
            <section
              key={key}
              className={`board-lane ${target?.lane === key ? 'board-lane-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragging && !target) setTarget({ lane: key, index: column.length });
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(key, target?.lane === key ? target.index : column.length);
              }}
            >
              <header className="board-lane-head">
                <span className="board-lane-title">{label}</span>
                <span className="board-lane-count">{column.length}</span>
                <button
                  className="nav-group-add"
                  title={`Add to ${label}`}
                  disabled={readOnly}
                  onClick={() => onAdd(key)}
                >
                  +
                </button>
              </header>

              <div className="board-cards">
                {column.length === 0 && (
                  <p className="board-empty">Nothing here.</p>
                )}

                {column.map((card, i) => (
                  <div key={card.id}>
                    <div
                      className={`board-gap ${isTarget(key, i) ? 'board-gap-active' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTarget({ lane: key, index: i });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        drop(key, i);
                      }}
                    />
                    <article
                      className={`card board-card ${
                        dragging?.id === card.id ? 'board-card-dragging' : ''
                      } ${overdue.has(card.id) ? 'board-card-overdue' : ''}`}
                      draggable={!readOnly}
                      onDragStart={() => setDragging(card)}
                      onDragEnd={() => {
                        setDragging(null);
                        setTarget(null);
                      }}
                      onClick={() => onEdit(card)}
                    >
                      <div className="board-card-title">{card.title}</div>
                      {card.notes && (
                        <p className="board-card-notes">{card.notes}</p>
                      )}
                      <div className="board-card-meta">
                        {card.creator_id && creatorById.has(card.creator_id) && (
                          <CreatorAvatar
                            creator={creatorById.get(card.creator_id) as Creator}
                            size={20}
                          />
                        )}
                        {card.due_date && (
                          <span
                            className={`pill ${
                              overdue.has(card.id) ? 'pill-overdue' : 'pill-due'
                            }`}
                          >
                            {new Date(card.due_date).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        )}
                        {card.assignee && (
                          <span
                            className={`activity-avatar avatar-${card.assignee.toLowerCase()} board-card-who`}
                            title={card.assignee}
                          >
                            {card.assignee[0]}
                          </span>
                        )}
                      </div>
                    </article>
                  </div>
                ))}

                <div
                  className={`board-gap board-gap-last ${
                    isTarget(key, column.length) ? 'board-gap-active' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTarget({ lane: key, index: column.length });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(key, column.length);
                  }}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

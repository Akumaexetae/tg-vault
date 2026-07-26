import type { ReactNode } from 'react';

interface Props {
  label: string;
  active: boolean;
  expanded: boolean;
  count?: number;
  onNavigate: () => void;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * A top-level nav item that owns a nested list — clicking the label navigates
 * and opens it; the chevron opens or closes without navigating.
 */
export function NavGroup({
  label,
  active,
  expanded,
  count,
  onNavigate,
  onToggle,
  action,
  children,
}: Props) {
  return (
    <div className="nav-group">
      <div className={`nav-item nav-group-head ${active ? 'nav-item-active' : ''}`}>
        <button className="nav-group-label" onClick={onNavigate}>
          {label}
          {count !== undefined && <span className="nav-group-count">{count}</span>}
        </button>
        {action}
        <button
          className="nav-group-chevron"
          title={expanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path
              d={
                expanded
                  ? 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z'
                  : 'M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.42 1.41l4.58-4.58a1 1 0 0 0 0-1.42L10.71 6.7a1 1 0 0 0-1.42 0z'
              }
            />
          </svg>
        </button>
      </div>
      {expanded && <div className="nav-children">{children}</div>}
    </div>
  );
}

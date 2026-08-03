import { ModalOverlay } from './ModalOverlay';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <ModalOverlay onDismiss={onCancel}>
      <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="confirm-body">{body}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

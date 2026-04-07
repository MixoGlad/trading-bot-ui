import React from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="session-warning-modal-backdrop">
      <div className="session-warning-modal">
        <h2>Confirm Action</h2>
        <p style={{ margin: '1.5rem 0', color: 'var(--text-color)' }}>{message}</p>
        <div className="modal-buttons">
          <button onClick={onClose} className="modal-btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="modal-btn-primary"
            style={{ backgroundColor: '#f44336' }} // Red color for destructive action
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

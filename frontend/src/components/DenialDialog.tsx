import React, { useState } from 'react';
import axiosInstance from '../config/axios.config';
import '../styles/DenialDialog.css';

interface AccessRequest {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName: string;
}

interface DenialDialogProps {
  request: AccessRequest;
  onClose: () => void;
  onComplete: () => void;
}

const DenialDialog: React.FC<DenialDialogProps> = ({
  request,
  onClose,
  onComplete,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeny = async () => {
    try {
      setLoading(true);
      setError(null);

      await axiosInstance.post(
        `/documents/${request.documentId}/access-grants/${request.id}/deny`,
        {
          reason: reason || undefined,
        }
      );

      onComplete();
    } catch (err) {
      console.error(err);
      setError('Failed to deny access request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="denial-dialog">
        <div className="dialog-header">
          <h2>Deny Access Request</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-content">
          <div className="request-info">
            <p>
              <strong>Requestor:</strong> {request.requestorName} ({request.requestorEmail})
            </p>
            <p>
              <strong>File:</strong> {request.filename}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="reason">Reason for Denial (Optional)</label>
            <textarea
              id="reason"
              placeholder="Provide a reason for denial (optional). The requestor will receive this message."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              disabled={loading}
              rows={4}
            />
            <small>{reason.length}/500</small>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="dialog-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-deny"
            onClick={handleDeny}
            disabled={loading}
          >
            {loading ? 'Denying...' : 'Confirm Denial'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DenialDialog;

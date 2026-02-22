import React, { useState } from 'react';
import axiosInstance from '../config/axios.config';
import '../styles/ApprovalDialog.css';

interface AccessRequest {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName: string;
}

interface ApprovalDialogProps {
  request: AccessRequest;
  onClose: () => void;
  onComplete: () => void;
}

const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  request,
  onClose,
  onComplete,
}) => {
  const [expiryDate, setExpiryDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMinDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const handleApprove = async () => {
    if (!expiryDate) {
      setError('Expiry date is required');
      return;
    }

    const selectedDate = new Date(expiryDate);
    const now = new Date();
    if (selectedDate <= now) {
      setError('Expiry date must be in the future');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await axiosInstance.post(
        `/documents/${request.documentId}/access-grants/${request.id}/approve`,
        {
          expiryDate,
          message: message || undefined,
        }
      );

      onComplete();
    } catch (err) {
      console.error(err);
      setError('Failed to approve access request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="approval-dialog">
        <div className="dialog-header">
          <h2>Approve Access Request</h2>
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
            <label htmlFor="expiryDate">
              Expiry Date <span className="required">*</span>
            </label>
            <input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={getMinDate()}
              disabled={loading}
            />
            <small>Access will automatically expire on this date at 23:59:59 UTC</small>
          </div>

          <div className="form-group">
            <label htmlFor="message">Optional Message</label>
            <textarea
              id="message"
              placeholder="Add a message for the requestor (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              disabled={loading}
              rows={4}
            />
            <small>{message.length}/500</small>
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
            className="btn-approve"
            onClick={handleApprove}
            disabled={loading || !expiryDate}
          >
            {loading ? 'Approving...' : 'Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalDialog;

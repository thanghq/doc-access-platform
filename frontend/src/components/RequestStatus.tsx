import React, { useState, useEffect } from 'react';
import axiosInstance from '../config/axios.config';
import { AxiosError } from 'axios';
import '../styles/RequestStatus.css';

interface RequestStatus {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName: string;
  ownerEmail: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  requestedAt: Date;
  expiryDate?: Date;
  denialReason?: string;
  approvalMessage?: string;
  actionCompletedAt?: Date;
  accessUrl?: string;
}

interface RequestStatusPageProps {
  requestUUID?: string;
}


const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'status-pending' },
    approved: { label: 'Approved', color: 'status-approved' },
    denied: { label: 'Denied', color: 'status-denied' },
    revoked: { label: 'Revoked', color: 'status-revoked' },
  };

  const config = statusConfig[status] || statusConfig['pending'];

  return <span className={`status-badge ${config.color}`}>{config.label}</span>;
};

export const RequestStatusPage: React.FC<RequestStatusPageProps> = ({
  requestUUID: initialUUID,
}) => {
  const [uuid, setUuid] = useState(initialUUID || '');
  const [requestStatus, setRequestStatus] = useState<RequestStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(!!initialUUID);

  useEffect(() => {
    if (initialUUID) {
      fetchRequestStatus(initialUUID);
    }
  }, [initialUUID]);

  const fetchRequestStatus = async (uuidToFetch: string) => {
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await axiosInstance.get<RequestStatus>(
        `/public/requests/${uuidToFetch}/status`,
      );

      setRequestStatus(response.data);
    } catch (err) {
      const axiosError = err as AxiosError;
      setError(
        (axiosError.response?.data as any)?.message ||
          'Failed to fetch request status',
      );
      setRequestStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uuid.trim()) {
      fetchRequestStatus(uuid);
    }
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (expiryDate?: Date | string): number | null => {
    if (!expiryDate) return null;

    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="request-status-page">
      <div className="status-header">
        <h1>Request Status</h1>
        <p>Check the status of your access request</p>
      </div>

      <div className="status-search-section">
        <form onSubmit={handleSearch} className="status-search-form">
          <div className="search-input-group">
            <input
              type="text"
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              placeholder="Enter your request UUID"
              className="status-search-input"
              disabled={loading}
            />
            <button
              type="submit"
              className="status-search-btn"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Check Status'}
            </button>
          </div>
          <small className="search-hint">
            You received this UUID in your confirmation email
          </small>
        </form>
      </div>

      {error && !searched && (
        <div className="info-message">
          Enter your request UUID to check the status
        </div>
      )}

      {error && searched && (
        <div className="error-message">{error}</div>
      )}

      {loading && <div className="loading">Fetching request status...</div>}

      {requestStatus && (
        <div className="status-result">
          <div className="result-card">
            <div className="result-header">
              <h2>{requestStatus.filename}</h2>
              <StatusBadge status={requestStatus.status} />
            </div>

            <div className="result-content">
              <div className="info-section">
                <h3>Request Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Request UUID:</span>
                    <code className="info-value">{requestStatus.id}</code>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Requested By:</span>
                    <span className="info-value">
                      {requestStatus.requestorName} ({requestStatus.requestorEmail})
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Document Owner:</span>
                    <span className="info-value">
                      {requestStatus.ownerEmail}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Requested On:</span>
                    <span className="info-value">
                      {formatDate(requestStatus.requestedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {requestStatus.status === 'pending' && (
                <div className="status-section pending">
                  <h3>Status: Pending</h3>
                  <p>
                    Your request is pending review. The document owner will respond as soon as possible.
                  </p>
                  <p className="status-tip">
                    ℹ️ Check back later or look for an email update
                  </p>
                </div>
              )}

              {requestStatus.status === 'approved' && (
                <div className="status-section approved">
                  <h3>Status: Approved ✓</h3>
                  <p>Great! Your request has been approved.</p>

                  {requestStatus.approvalMessage && (
                    <div className="message-box">
                      <p className="message-label">Owner's Message:</p>
                      <p>{requestStatus.approvalMessage}</p>
                    </div>
                  )}

                  {requestStatus.expiryDate && (
                    <div className="expiry-info">
                      <p className="expiry-label">Expires:</p>
                      <p className="expiry-value">
                        {formatDate(requestStatus.expiryDate)}
                      </p>
                      {getDaysRemaining(requestStatus.expiryDate) !== null && (
                        <p className="days-remaining">
                          {getDaysRemaining(requestStatus.expiryDate)} days remaining
                        </p>
                      )}
                    </div>
                  )}

                  {requestStatus.accessUrl && (
                    <div className="access-actions">
                      <a
                        href={requestStatus.accessUrl}
                        className="access-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Access Document →
                      </a>
                    </div>
                  )}
                </div>
              )}

              {requestStatus.status === 'denied' && (
                <div className="status-section denied">
                  <h3>Status: Denied</h3>
                  <p>Your access request has been denied by the document owner.</p>

                  {requestStatus.denialReason && (
                    <div className="message-box">
                      <p className="message-label">Reason:</p>
                      <p>{requestStatus.denialReason}</p>
                    </div>
                  )}

                  <p className="status-tip">
                    You can contact the document owner for more information.
                  </p>
                </div>
              )}

              {requestStatus.status === 'revoked' && (
                <div className="status-section revoked">
                  <h3>Status: Revoked</h3>
                  <p>
                    Your access to this document has been revoked by the owner.
                  </p>

                  {requestStatus.actionCompletedAt && (
                    <p className="timestamp">
                      Revoked on: {formatDate(requestStatus.actionCompletedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="result-actions">
              <button
                className="back-btn"
                onClick={() => {
                  window.location.href = '/catalog';
                }}
              >
                Back to Catalog
              </button>
              <button
                className="new-search-btn"
                onClick={() => {
                  setUuid('');
                  setRequestStatus(null);
                  setSearched(false);
                }}
              >
                Check Another Request
              </button>
            </div>
          </div>
        </div>
      )}

      {searched && !requestStatus && !loading && !error && (
        <div className="no-result">
          <p>No request found. Please verify the UUID and try again.</p>
        </div>
      )}
    </div>
  );
};

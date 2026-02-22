import React, { useState, useEffect } from 'react';
import axiosInstance from '../config/axios.config';
import '../styles/AuditTrail.css';

interface AuditTrailEntry {
  id: string;
  action: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  reason?: string;
  message?: string;
  timestamp: string;
  details?: string;
}

interface AuditTrailProps {
  refreshTrigger: number;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ refreshTrigger }) => {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 20;

  useEffect(() => {
    fetchAuditTrail();
  }, [page, refreshTrigger]);

  const fetchAuditTrail = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await axiosInstance.get(
        `/documents/access-requests/audit-trail?${params}`
      );
      setEntries(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      setError('Failed to fetch audit trail');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: { [key: string]: string } = {
      REQUEST_APPROVED: 'Request Approved',
      REQUEST_DENIED: 'Request Denied',
      REQUEST_REVOKED: 'Access Revoked',
      REQUEST_BULK_REVOKED: 'Bulk Access Revoked',
    };
    return labels[action] || action;
  };

  const getActionBadgeClass = (action: string): string => {
    if (action.includes('APPROVED')) return 'action-approved';
    if (action.includes('DENIED')) return 'action-denied';
    if (action.includes('REVOKED')) return 'action-revoked';
    return 'action-default';
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && entries.length === 0) {
    return <div className="loading">Loading audit trail...</div>;
  }

  return (
    <div className="audit-trail">
      {error && <div className="error-message">{error}</div>}

      {entries.length === 0 ? (
        <div className="no-entries">
          <p>No audit trail entries found</p>
        </div>
      ) : (
        <>
          <div className="entries-info">
            <p>Showing {entries.length} of {total} entries</p>
          </div>

          <div className="timeline">
            {entries.map((entry) => (
              <div key={entry.id} className="timeline-entry">
                <div className="entry-header">
                  <span className={`action-badge ${getActionBadgeClass(entry.action)}`}>
                    {getActionLabel(entry.action)}
                  </span>
                  <span className="timestamp">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="entry-content">
                  <div className="entry-info">
                    <p>
                      <strong>File:</strong> {entry.filename}
                    </p>
                    <p>
                      <strong>Requestor:</strong> {entry.requestorEmail}
                    </p>
                  </div>

                  {entry.details && (
                    <div className="entry-details">
                      <p>{entry.details}</p>
                    </div>
                  )}

                  {entry.reason && (
                    <div className="entry-reason">
                      <strong>Reason:</strong> {entry.reason}
                    </div>
                  )}

                  {entry.message && (
                    <div className="entry-message">
                      <strong>Message:</strong> {entry.message}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditTrail;

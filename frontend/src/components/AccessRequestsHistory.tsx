import React, { useState, useEffect } from 'react';
import axiosInstance from '../config/axios.config';
import '../styles/AccessRequestsHistory.css';

interface AccessRequest {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName: string;
  status: string;
  expiryDate?: string;
  denialReason?: string;
  actionCompletedAt?: string;
  requestedAt: string;
}

interface AccessRequestsHistoryProps {
  refreshTrigger: number;
}

const AccessRequestsHistory: React.FC<AccessRequestsHistoryProps> = ({
  refreshTrigger,
}) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchEmail, setSearchEmail] = useState('');
  const [filterFilename, setFilterFilename] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const limit = 10;

  useEffect(() => {
    fetchHistory();
  }, [page, refreshTrigger]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchEmail && { searchEmail }),
        ...(filterFilename && { filterFilename }),
        ...(filterStatus && { filterStatus }),
      });

      const response = await axiosInstance.get(
        `/documents/access-requests/history?${params}`
      );
      setRequests(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      setError('Failed to fetch access request history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchHistory();
  };

  const handleClearFilters = () => {
    setSearchEmail('');
    setFilterFilename('');
    setFilterStatus('');
    setPage(1);
  };

  const getStatusBadgeClass = (status: string) => {
    return `status-badge status-${status.toLowerCase()}`;
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && requests.length === 0) {
    return <div className="loading">Loading request history...</div>;
  }

  return (
    <div className="access-requests-history">
      <div className="filters">
        <div className="filter-group">
          <label>Search by Email:</label>
          <input
            type="email"
            placeholder="requestor@example.com"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Filter by Filename:</label>
          <input
            type="text"
            placeholder="document.pdf"
            value={filterFilename}
            onChange={(e) => setFilterFilename(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Filter by Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div className="filter-actions">
          <button className="btn-search" onClick={handleSearch}>
            Search
          </button>
          <button className="btn-clear" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {requests.length === 0 ? (
        <div className="no-requests">
          <p>No request history found</p>
        </div>
      ) : (
        <>
          <div className="requests-info">
            <p>Showing {requests.length} of {total} requests</p>
          </div>

          <div className="requests-table">
            <table>
              <thead>
                <tr>
                  <th>Requestor Email</th>
                  <th>Requestor Name</th>
                  <th>Target File</th>
                  <th>Status</th>
                  <th>Request Date</th>
                  <th>Action Date</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.requestorEmail}</td>
                    <td>{request.requestorName}</td>
                    <td>{request.filename}</td>
                    <td>
                      <span className={getStatusBadgeClass(request.status)}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </td>
                    <td>
                      {request.actionCompletedAt && 
                        new Date(request.actionCompletedAt).toLocaleDateString()
                      }
                    </td>
                    <td className="details">
                      {request.status === 'approved' && request.expiryDate && (
                        <span className="detail-info">
                          Expires: {new Date(request.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                      {request.status === 'denied' && request.denialReason && (
                        <span className="detail-info" title={request.denialReason}>
                          {request.denialReason.substring(0, 30)}...
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default AccessRequestsHistory;

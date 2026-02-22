import React, { useState, useEffect } from 'react';
import axiosInstance from '../config/axios.config';
import ApprovalDialog from './ApprovalDialog';
import DenialDialog from './DenialDialog';
import '../styles/AccessRequestsList.css';

interface AccessRequest {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName: string;
  requestorOrganization?: string;
  requestPurpose?: string;
  status: string;
  requestedAt: string;
}

interface AccessRequestsListProps {
  onActionCompleted: () => void;
  refreshTrigger: number;
}

const AccessRequestsList: React.FC<AccessRequestsListProps> = ({
  onActionCompleted,
  refreshTrigger,
}) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchEmail, setSearchEmail] = useState('');
  const [filterFilename, setFilterFilename] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDenialDialog, setShowDenialDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);

  const limit = 10;

  useEffect(() => {
    fetchRequests();
  }, [page, refreshTrigger]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchEmail && { searchEmail }),
        ...(filterFilename && { filterFilename }),
      });

      const response = await axiosInstance.get(
        `/documents/access-requests/pending?${params}`
      );
      setRequests(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      setError('Failed to fetch access requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request: AccessRequest) => {
    setSelectedRequest(request);
    setShowApprovalDialog(true);
  };

  const handleDeny = (request: AccessRequest) => {
    setSelectedRequest(request);
    setShowDenialDialog(true);
  };

  const handleApprovalComplete = async () => {
    setShowApprovalDialog(false);
    setSelectedRequest(null);
    fetchRequests();
    onActionCompleted();
  };

  const handleDenialComplete = async () => {
    setShowDenialDialog(false);
    setSelectedRequest(null);
    fetchRequests();
    onActionCompleted();
  };

  const handleSearch = () => {
    setPage(1);
    fetchRequests();
  };

  const handleClearFilters = () => {
    setSearchEmail('');
    setFilterFilename('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && requests.length === 0) {
    return <div className="loading">Loading access requests...</div>;
  }

  return (
    <div className="access-requests-list">
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
          <p>No pending access requests</p>
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
                  <th>Organization</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.requestorEmail}</td>
                    <td>{request.requestorName}</td>
                    <td>{request.filename}</td>
                    <td>{request.requestorOrganization || '-'}</td>
                    <td>
                      {new Date(request.requestedAt).toLocaleDateString()} {new Date(request.requestedAt).toLocaleTimeString()}
                    </td>
                    <td className="actions">
                      <button
                        className="btn-approve"
                        onClick={() => handleApprove(request)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-deny"
                        onClick={() => handleDeny(request)}
                      >
                        Deny
                      </button>
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

      {selectedRequest && (
        <>
          {showApprovalDialog && (
            <ApprovalDialog
              request={selectedRequest}
              onClose={() => setShowApprovalDialog(false)}
              onComplete={handleApprovalComplete}
            />
          )}
          {showDenialDialog && (
            <DenialDialog
              request={selectedRequest}
              onClose={() => setShowDenialDialog(false)}
              onComplete={handleDenialComplete}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AccessRequestsList;

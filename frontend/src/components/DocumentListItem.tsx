import React, { useState, useEffect } from 'react';
import documentService, { DocumentResponse } from '../services/documentService';
import '../styles/DocumentListItem.css';

interface DocumentListItemProps {
  document: DocumentResponse;
  onDeleteSuccess: () => void;
}

const DocumentListItem: React.FC<DocumentListItemProps> = ({ document, onDeleteSuccess }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss error after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: string | Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleToggleVisibility = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      const newStatus = document.visibilityStatus === 'public' ? 'hidden' : 'public';
      await documentService.updateDocumentVisibility(document.id, newStatus);
      document.visibilityStatus = newStatus;
      setIsUpdating(false);
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message || err?.message;
      setError(backendMessage || 'Failed to update visibility. Please try again.');
      console.error('Visibility error:', err);
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this document?')) {
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      await documentService.deleteDocument(document.id);
      onDeleteSuccess();
    } catch (err: any) {
      // Extract error message from backend response
      const backendMessage = err?.response?.data?.message || err?.message;
      
      if (backendMessage) {
        setError(backendMessage);
      } else {
        setError('Failed to delete document. Please try again.');
      }
      
      console.error('Delete error:', err);
      setIsUpdating(false);
    }
  };

  const handleRevokeAllAccess = async () => {
    if (!window.confirm(
      `Are you sure you want to revoke all ${document.activeAccessGrantsCount} active access grant(s) for this document?`
    )) {
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      await documentService.bulkRevokeAccess(document.id);
      // Refresh the document list to update counts
      onDeleteSuccess();
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message || err?.message;
      setError(backendMessage || 'Failed to revoke access. Please try again.');
      console.error('Revoke error:', err);
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="table-row">
        <div className="col-filename">
          <button className="link-button" onClick={() => setShowDetails(!showDetails)}>
            {document.filename}
          </button>
        </div>
        <div className="col-size">{formatFileSize(document.fileSize)}</div>
        <div className="col-type">{document.fileType.toUpperCase()}</div>
        <div className="col-date">{formatDate(document.uploadedAt)}</div>
        <div className="col-status">
          <span className={`status-badge ${document.visibilityStatus}`}>
            {document.visibilityStatus === 'public' ? 'Public' : 'Hidden'}
          </span>
        </div>
        <div className="col-access">
          <span className="access-count">
            {document.activeAccessGrantsCount}/{document.accessGrantsCount}
          </span>
        </div>
        <div className="col-actions">
          <button
            className="btn-action btn-icon btn-visibility"
            onClick={handleToggleVisibility}
            disabled={isUpdating}
            title={
              document.visibilityStatus === 'public'
                ? 'Hide from public directory'
                : 'Make visible in public directory'
            }
          >
            <span className="icon material-icons">
              {document.visibilityStatus === 'public' ? 'visibility_off' : 'visibility'}
            </span>
          </button>
          {document.activeAccessGrantsCount > 0 && (
            <button
              className="btn-action btn-icon btn-revoke"
              onClick={handleRevokeAllAccess}
              disabled={isUpdating}
              title={`Revoke all ${document.activeAccessGrantsCount} active access grant(s)`}
            >
              <span className="icon material-icons">block</span>
            </button>
          )}
          <button
            className="btn-action btn-icon btn-delete"
            onClick={handleDelete}
            disabled={isUpdating}
            title="Delete this document"
          >
            <span className="icon material-icons">delete</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="table-row">
          <div className="error-notification" style={{ 
            gridColumn: '1 / -1', 
            padding: '12px 16px',
            // backgroundColor: '#fee',
            // borderLeft: '4px solid #dc3545',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div className="error-message" style={{ margin: 0, flex: 1 }}>{error}</div>
           
          </div>
        </div>
      )}

      {showDetails && (
        <div className="detail-panel">
          <div className="detail-content">
            <h3>Document Details</h3>
            <dl>
              <dt>Filename:</dt>
              <dd>{document.filename}</dd>
              <dt>File Type:</dt>
              <dd>{document.fileType.toUpperCase()}</dd>
              <dt>File Size:</dt>
              <dd>{formatFileSize(document.fileSize)}</dd>
              <dt>Upload Date:</dt>
              <dd>{formatDate(document.uploadedAt)}</dd>
              <dt>Visibility:</dt>
              <dd>{document.visibilityStatus === 'public' ? 'Public' : 'Hidden'}</dd>
              <dt>Access Requests:</dt>
              <dd>
                {document.activeAccessGrantsCount} active of {document.accessGrantsCount} total
              </dd>
              {document.description && (
                <>
                  <dt>Description:</dt>
                  <dd>{document.description}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentListItem;

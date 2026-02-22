import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../config/axios.config';
import { AxiosError } from 'axios';
import AccessRequestForm from './AccessRequestForm';
import '../styles/PublicCatalog.css';

interface Document {
  id: string;
  filename: string;
  fileType: 'pdf' | 'xlsx' | 'docx';
  fileSize: number;
  description?: string;
  uploadedAt: Date;
  ownerEmail: string;
  ownerName: string;
}

interface PaginatedResponse {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export const PublicCatalog: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (searchQuery) {
        params.append('query', searchQuery);
      }

      if (selectedFileTypes.length > 0) {
        selectedFileTypes.forEach((type) => {
          params.append('fileTypes', type);
        });
      }

      params.append('page', currentPage.toString());
      params.append('limit', '10');

      const response = await axiosInstance.get<PaginatedResponse>(
        `/public/documents?${params.toString()}`,
      );

      setDocuments(response.data.data);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(
        axiosError.response?.data?.message || 'Failed to fetch documents',
      );
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedFileTypes,currentPage]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setCurrentPage(1);
      fetchDocuments();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedFileTypes, fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [currentPage]);

  const handleFileTypeChange = (fileType: string) => {
    setSelectedFileTypes((prev) => {
      if (prev.includes(fileType)) {
        return prev.filter((t) => t !== fileType);
      }
      return [...prev, fileType];
    });
  };

  const handleRequestAccess = (document: Document) => {
    setSelectedDocument(document);
    setShowRequestModal(true);
  };

  const handleCloseModal = () => {
    setShowRequestModal(false);
    setSelectedDocument(null);
  };

  const handleRequestSuccess = (requestUUID: string) => {
    // Modal will show success message, user can close it manually
    console.log('Access request submitted:', requestUUID);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="public-catalog">
      <div className="catalog-header">
        <h1>Document Catalog</h1>
        <p>Browse and request access to public documents</p>
      </div>

      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search documents by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>



        <div className="filters-panel">
          <div className="filter-group">
            <label>File Type</label>
            <div className="filter-options">
              {['pdf', 'xlsx', 'docx'].map((type) => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedFileTypes.includes(type.toUpperCase())}
                    onChange={() =>
                      handleFileTypeChange(type.toUpperCase())
                    }
                  />
                  {type.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

        </div>

      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="no-documents">
          <p>No documents found. Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="documents-grid">
            {documents.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <h3 className="document-filename">{doc.filename}</h3>
                  <span className="file-type-badge">{doc.fileType}</span>
                </div>

                <div className="document-meta">
                  <div className="meta-item">
                    <span className="meta-label">Size:</span>
                    <span className="meta-value">{formatFileSize(doc.fileSize)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Uploaded:</span>
                    <span className="meta-value">
                      {formatDate(doc.uploadedAt)}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Description:</span>
                    <span className="meta-value">{doc.description}</span>
                  </div>
                </div>

                <button
                  className="request-access-btn"
                  onClick={() => handleRequestAccess(doc)}
                >
                  Request Access
                </button>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>

            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Access Request Modal */}
      {showRequestModal && selectedDocument && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseModal}>
              ×
            </button>
            <AccessRequestForm
              documentId={selectedDocument.id}
              documentFilename={selectedDocument.filename}
              onSuccess={handleRequestSuccess}
              onCancel={handleCloseModal}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicCatalog;

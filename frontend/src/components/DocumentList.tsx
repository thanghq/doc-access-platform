import React, { useState, useEffect, useCallback } from 'react';
import documentService, { DocumentResponse } from '../services/documentService';
import DocumentListItem from './DocumentListItem';
import '../styles/DocumentList.css';

interface DocumentListProps {
  refreshTrigger: number;
}

const DocumentList: React.FC<DocumentListProps> = ({ refreshTrigger }) => {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileTypes, setSelectedFileTypes] = useState<('pdf' | 'xlsx' | 'docx')[]>([]);
  const [sortBy, setSortBy] = useState<'uploadedAt' | 'filename' | 'fileSize'>('uploadedAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const ITEMS_PER_PAGE = 10;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await documentService.getMyDocuments({
        page,
        limit: ITEMS_PER_PAGE,
        query: searchQuery || undefined,
        fileTypes: selectedFileTypes.length > 0 ? selectedFileTypes : undefined,
        sortBy,
        sortOrder,
      });

      setDocuments(response.data);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError('Failed to load documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedFileTypes, sortBy, sortOrder]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);



  const handleFilterChange = (fileType: 'pdf' | 'xlsx' | 'docx') => {
    setSelectedFileTypes((prev) =>
      prev.includes(fileType) ? prev.filter((t) => t !== fileType) : [...prev, fileType],
    );
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedFileTypes([]);
    setSortBy('uploadedAt');
    setSortOrder('DESC');
    setPage(1);
  };

  const handleSort = (field: 'uploadedAt' | 'filename' | 'fileSize') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const handleDeleteSuccess = () => {
    fetchDocuments();
  };

  return (
    <div className="document-list-container">
      <div className="filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search documents by name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="btn-clear-search"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="filter-group">
          <h3>Filter by File Type</h3>
          <div className="file-type-filters">
            {['pdf', 'xlsx', 'docx'].map((type) => (
              <label key={type} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedFileTypes.includes(type as 'pdf' | 'xlsx' | 'docx')}
                  onChange={() => handleFilterChange(type as 'pdf' | 'xlsx' | 'docx')}
                />
                <span>{type.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>

        {(searchQuery || selectedFileTypes.length > 0) && (
          <button className="btn-clear-filters" onClick={handleClearFilters}>
            Clear All Filters
          </button>
        )}

        <div className="sort-controls">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => handleSort(e.target.value as 'uploadedAt' | 'filename' | 'fileSize')}>
            <option value="uploadedAt">Upload Date</option>
            <option value="filename">File Name</option>
            <option value="fileSize">File Size</option>
          </select>
          <button
            className="btn-sort-order"
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
          >
            {sortOrder === 'ASC' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-spinner">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents found. {searchQuery && 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <>
          <div className="documents-table">
            <div className="table-header">
              <div className="col-filename">File Name</div>
              <div className="col-size">Size</div>
              <div className="col-type">Type</div>
              <div className="col-date">Upload Date</div>
              <div className="col-status">Status</div>
              <div className="col-access">Access Grants</div>
              <div className="col-actions">Actions</div>
            </div>

            {documents.map((doc) => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                onDeleteSuccess={handleDeleteSuccess}
              />
            ))}
          </div>

          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="btn-pagination"
            >
              Previous
            </button>
            <span className="page-info">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="btn-pagination"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentList;

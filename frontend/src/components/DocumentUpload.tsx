import React, { useState } from 'react';
import documentService from '../services/documentService';
import '../styles/DocumentUpload.css';

interface DocumentUploadProps {
  onUploadSuccess: () => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'docx'];
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    return extension;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) {
      setError(null);
      setFile(null);
      return;
    }

    const fileType = getFileType(selectedFile.name);

    if (!ALLOWED_EXTENSIONS.includes(fileType)) {
      setError(
        `File type not supported. Allowed types: ${ALLOWED_EXTENSIONS
          .map((t) => t.toUpperCase())
          .join(', ')}`,
      );
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024} MB. Your file is ${(
          selectedFile.size /
          1024 /
          1024
        ).toFixed(2)} MB`,
      );
      setFile(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
    setFilename(selectedFile.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !filename.trim()) {
      setError('Please select a file and enter a filename');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const fileType = getFileType(file.name);
      await documentService.uploadDocument(file, filename, fileType, description || undefined);

      setSuccess(true);
      setFile(null);
      setFilename('');
      setDescription('');

      setTimeout(() => {
        onUploadSuccess();
      }, 1500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to upload document');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-form-container">
      <form onSubmit={handleSubmit} className="upload-form">
        <h2>Upload Document</h2>

        <div className="form-group">
          <label htmlFor="file-input">Select File (PDF, XLSX, DOCX)</label>
          <input
            id="file-input"
            type="file"
            accept=".pdf,.xlsx,.docx"
            onChange={handleFileSelect}
            disabled={loading}
            className="file-input"
          />
          {file && <span className="file-selected">{file.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="filename">Document Name *</label>
          <input
            id="filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="e.g., quarterly-report-2025"
            required
            disabled={loading}
            className="text-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description (Optional)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a brief description of this document..."
            disabled={loading}
            className="textarea-input"
            rows={3}
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">✓ Document uploaded successfully!</div>}

        <div className="form-actions">
          <button type="submit" disabled={!file || !filename.trim() || loading} className="btn-primary">
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>

        <div className="file-info">
          <p>Maximum file size: 100 MB</p>
          <p>Supported formats: PDF, XLSX, DOCX</p>
          <p>Files are hidden by default and must be made visible to appear in the public directory</p>
        </div>
      </form>
    </div>
  );
};

export default DocumentUpload;

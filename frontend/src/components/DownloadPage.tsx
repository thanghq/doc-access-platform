import React, { useState, useEffect } from 'react';
import axiosInstance from '../config/axios.config';
import { AxiosError } from 'axios';
import '../styles/DownloadPage.css';

interface DownloadPageProps {
  downloadSessionToken: string;
  onSessionExpired?: () => void;
}

interface SessionStatus {
  isValid: boolean;
  expiresIn: number;
  requestorEmail: string;
  documentName: string;
}


const DownloadPage: React.FC<DownloadPageProps> = ({
  downloadSessionToken,
  onSessionExpired,
}) => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [sessionExpiresIn, setSessionExpiresIn] = useState(0);

  useEffect(() => {
    // Validate session on mount
    validateSession();

    // Set up timer to check session expiry
    const expiryInterval = setInterval(() => {
      setSessionExpiresIn((prev) => {
        if (prev <= 1) {
          handleSessionExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(expiryInterval);
  }, []);

  const validateSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post<SessionStatus>(
        `/verification/validate-session`,
        {
          downloadSessionToken,
        },
      );

      setSessionStatus(response.data);
      setSessionExpiresIn(response.data.expiresIn);
    } catch (err) {
      const axiosError = err as AxiosError;
      const message =
        (axiosError.response?.data as any)?.message ||
        'Session validation failed. Please verify again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionExpired = () => {
    setError('Your session has expired for security reasons. Please verify again.');
    if (onSessionExpired) {
      onSessionExpired();
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress(0);

    try {
      const response = await axiosInstance.get(
        `/verification/download/${downloadSessionToken}`,
        {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              setDownloadProgress(percentCompleted);
            }
          },
        },
      );

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = sessionStatus?.documentName || 'document';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)|filename="(.+)"|filename=([^;]+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2] || filenameMatch[3]);
        }
      }

      // Create blob URL and download
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Re-validate session after download
      await validateSession();
    } catch (err) {
      const axiosError = err as AxiosError;
      const message =
        (axiosError.response?.data as any)?.message || 'Download failed. Please try again.';

      setError(message);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="download-page-container">
        <div className="loading">Validating download session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="download-page-container">
        <div className="error-section">
          <h2>Access Issue</h2>
          <p className="error-message">{error}</p>
          <button
            className="retry-btn"
            onClick={() => {
              window.location.href = '/verify-access';
            }}
          >
            Verify Again
          </button>
        </div>
      </div>
    );
  }

  if (!sessionStatus) {
    return (
      <div className="download-page-container">
        <div className="error-section">
          <h2>Invalid Session</h2>
          <p>Your download session is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="download-page-container">
      <div className="download-header">
        <h1>Ready to Download</h1>
        <p>Your identity has been verified successfully</p>
      </div>

      <div className="document-metadata">
        <div className="metadata-card">
          <h3>Document Details</h3>
          <div className="metadata-item">
            <span className="metadata-label">Document Name:</span>
            <span className="metadata-value">{sessionStatus.documentName}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Requested By:</span>
            <span className="metadata-value">{sessionStatus.requestorEmail}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Session Expires In:</span>
            <span className={`metadata-value ${sessionExpiresIn < 300 ? 'warning' : ''}`}>
              {formatTime(sessionExpiresIn)}
            </span>
          </div>
        </div>
      </div>

      {downloading && (
        <div className="download-progress">
          <h3>Downloading...</h3>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${downloadProgress}%` }}>
              {downloadProgress}%
            </div>
          </div>
        </div>
      )}

      <div className="download-actions">
        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={downloading || !sessionStatus.isValid}
        >
          {downloading ? `Downloading (${downloadProgress}%)` : 'Download Document'}
        </button>
        <button
          className="verify-again-btn"
          onClick={() => {
            window.location.href = '/verify-access';
          }}
          disabled={downloading}
        >
          Verify Another Document
        </button>
      </div>


    </div>
  );
};

export default DownloadPage;

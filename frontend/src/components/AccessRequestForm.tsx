import React, { useState } from 'react';
import axiosInstance from '../config/axios.config';
import { AxiosError } from 'axios';
import '../styles/AccessRequestForm.css';

interface AccessRequestFormProps {
  documentId: string;
  documentFilename: string;
  onSuccess?: (requestUUID: string) => void;
  onCancel?: () => void;
}

interface FormData {
  requestorEmail: string;
  requestPurpose: string;
}

interface SubmissionResponse {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestUUID: string;
  status: string;
  message: string;
  retrievalPageUrl: string;
}


export const AccessRequestForm: React.FC<AccessRequestFormProps> = ({
  documentId,
  documentFilename,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<FormData>({
    requestorEmail: '',
    requestPurpose: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submissionData, setSubmissionData] = useState<SubmissionResponse | null>(
    null,
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.requestorEmail.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.requestorEmail)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!formData.requestPurpose.trim()) {
      setError('Purpose is required');
      return false;
    }

    if (formData.requestPurpose.length > 500) {
      setError('Purpose must be 500 characters or less');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await axiosInstance.post<SubmissionResponse>(
        `/public/documents/${documentId}/request-access`,
        {
          requestorEmail: formData.requestorEmail,
          requestPurpose: formData.requestPurpose,
        },
      );

      setSubmissionData(response.data);
      setSuccess(true);

      if (onSuccess) {
        onSuccess(response.data.requestUUID);
      }
    } catch (err) {
      const axiosError = err as AxiosError;
      const errorMessage =
        (axiosError.response?.data as any)?.message ||
        'Failed to submit access request';

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success && submissionData) {
    return (
      <div className="form-success">
        <div className="success-icon">✓</div>
        <h2>Request Submitted Successfully</h2>
        <p>Your access request for <strong>{documentFilename}</strong> has been submitted.</p>

        <div className="success-details">
          <div className="detail-item">
            <span className="detail-label">Request UUID:</span>
            <code className="detail-value">{submissionData.requestUUID}</code>
            <button
              className="copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(submissionData.requestUUID);
              }}
              title="Copy UUID"
            >
              Copy
            </button>
          </div>
          <p className="detail-note">
            Save this UUID to check your request status later.
          </p>
        </div>

        <div className="success-message">
          <p>We&apos;ve sent your request to the document owner.</p>
          <p>The document owner will review your request and respond.</p>
        </div>

        <div className="success-actions">
          <button
            className="catalog-btn"
            onClick={() => {
              window.location.href = '/catalog';
            }}
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="access-request-form-container">
      <div className="form-header">
        <h2>Request Access</h2>
        <p>Request access to: <strong>{documentFilename}</strong></p>
      </div>

      <form onSubmit={handleSubmit} className="access-request-form">
        <div className="form-group">
          <label htmlFor="requestorEmail" className="required-field">
            Email Address
          </label>
          <input
            type="email"
            id="requestorEmail"
            name="requestorEmail"
            value={formData.requestorEmail}
            onChange={handleInputChange}
            placeholder="your.email@example.com"
            className="form-input"
            disabled={loading}
            autoFocus
          />
          <small>We&apos;ll use this to notify you about your request</small>
        </div>

        <div className="form-group">
          <label htmlFor="requestPurpose" className="required-field">
            Request Purpose
          </label>
          <textarea
            id="requestPurpose"
            name="requestPurpose"
            value={formData.requestPurpose}
            onChange={handleInputChange}
            placeholder="Please explain why you need access to this document..."
            className="form-textarea"
            rows={4}
            maxLength={500}
            disabled={loading}
          />
          <small>{formData.requestPurpose.length}/500 characters</small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
          {onCancel && (
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>

      </form>
    </div>
  );
};

export default AccessRequestForm;

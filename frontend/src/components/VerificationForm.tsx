import React, { useState } from 'react';
import axiosInstance from '../config/axios.config';
import { AxiosError } from 'axios';
import '../styles/VerificationForm.css';

interface VerificationFormProps {
  onSuccess: (requestUUID: string, requestorEmail: string) => void;
  onCancel?: () => void;
}

interface VerificationResponse {
  success: boolean;
  message: string;
  requestUUID: string;
  requestorEmail: string;
  requestorName: string;
  documentName: string;
}


const VerificationForm: React.FC<VerificationFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [requestUUID, setRequestUUID] = useState('');
  const [requestorEmail, setRequestorEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (!requestUUID.trim()) {
      setError('UUID is required');
      return false;
    }

    if (!requestorEmail.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestorEmail)) {
      setError('Please enter a valid email address');
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
      const response = await axiosInstance.post<VerificationResponse>(
        `/verification/initiate`,
        {
          requestUUID,
          requestorEmail,
        },
      );

      if (response.data.success) {
        onSuccess(response.data.requestUUID, response.data.requestorEmail);
      }
    } catch (err) {
      const axiosError = err as AxiosError;
      const message =
        (axiosError.response?.data as any)?.message ||
        'Failed to verify. Please check your UUID and email.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verification-form-container">
      <div className="verification-header">
        <h1>Document Retrieval Portal</h1>
        <p>Verify Your Identity to Access Your Document</p>
      </div>


      <form onSubmit={handleSubmit} className="verification-form">
        <div className="form-group">
          <label htmlFor="requestUUID" className="required-field">
            Request UUID
          </label>
          <input
            type="text"
            id="requestUUID"
            value={requestUUID}
            onChange={(e) => setRequestUUID(e.target.value)}
            placeholder="Paste your UUID from the email"
            className="form-input"
            disabled={loading}
          />
          <small>Found in your approval email</small>
        </div>

        <div className="form-group">
          <label htmlFor="requestorEmail" className="required-field">
            Email Address
          </label>
          <input
            type="email"
            id="requestorEmail"
            value={requestorEmail}
            onChange={(e) => setRequestorEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="form-input"
            disabled={loading}
          />
          <small>Must match the email on your request</small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify and Proceed'}
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

export default VerificationForm;

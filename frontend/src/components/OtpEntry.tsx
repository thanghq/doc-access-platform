import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../config/axios.config';
import { AxiosError } from 'axios';
import '../styles/OtpEntry.css';

interface OtpEntryProps {
  requestUUID: string;
  requestorEmail: string;
  onSuccess: (downloadSessionToken: string) => void;
  onBack?: () => void;
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
  downloadSessionToken: string;
  expiresIn: number;
}

interface RequestOtpResponse {
  success: boolean;
  message: string;
  otpSentTo: string;
  expiresIn: number;
}


const OtpEntry: React.FC<OtpEntryProps> = ({
  requestUUID,
  requestorEmail,
  onSuccess,
  onBack,
}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [remainingTime, setRemainingTime] = useState(900); // 15 minutes
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [isLocked, setIsLocked] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Request OTP on mount
    requestNewOtp();

    // Cleanup timer on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (otpSent && remainingTime > 0) {
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            setError('OTP has expired. Request a new one.');
            setOtpSent(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [otpSent, remainingTime]);

  const requestNewOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post<RequestOtpResponse>(
        `/verification/request-otp`,
        {
          requestUUID,
          requestorEmail,
        },
      );

      setOtpSent(true);
      setRemainingTime(response.data.expiresIn);
      setOtp('');
      setRemainingAttempts(3);
      setIsLocked(false);

      if (otpInputRef.current) {
        otpInputRef.current.focus();
      }
    } catch (err) {
      const axiosError = err as AxiosError;
      const message =
        (axiosError.response?.data as any)?.message ||
        'Failed to send OTP. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    if (isLocked) {
      setError('Too many failed attempts. Please request a new OTP.');
      return;
    }

    setLoading(true);

    try {
      const response = await axiosInstance.post<VerifyOtpResponse>(
        `/verification/verify-otp`,
        {
          requestUUID,
          requestorEmail,
          otp,
        },
      );

      if (response.data.success) {
        onSuccess(response.data.downloadSessionToken);
      }
    } catch (err) {
      const axiosError = err as AxiosError;

      if (axiosError.response?.status === 409) {
        // Too many attempts
        setIsLocked(true);
        setError('Too many incorrect attempts. Please request a new OTP.');
      } else {
        const attempts = Math.max(0, remainingAttempts - 1);
        setRemainingAttempts(attempts);

        if (attempts === 0) {
          setIsLocked(true);
          setError('Maximum attempts exceeded. Please request a new OTP.');
        } else {
          const message =
            (axiosError.response?.data as any)?.message ||
            `Invalid OTP. ${attempts} attempts remaining.`;

          setError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!otpSent && loading) {
    return (
      <div className="otp-entry-container">
        <div className="loading">Sending OTP to your email...</div>
      </div>
    );
  }

  return (
    <div className="otp-entry-container">
      <div className="otp-header">
        <h2>Enter One-Time Password</h2>
        <p>We&apos;ve sent a 6-digit code to { requestorEmail}</p>
      </div>

      <form onSubmit={handleSubmit} className="otp-form">
        <div className="form-group">
          <label htmlFor="otp" className="required-field">
            6-Digit OTP Code
          </label>
          <input
            ref={otpInputRef}
            type="text"
            id="otp"
            value={otp}
            onChange={handleOtpChange}
            placeholder="000000"
            className="otp-input"
            maxLength={6}
            disabled={loading || isLocked}
            autoFocus
          />
          <small>Check your email for the code</small>
        </div>

        <div className="otp-status">
          <div className="status-item">
            <span className="status-label">Expires in:</span>
            <span className={`status-value ${remainingTime < 300 ? 'warning' : ''}`}>
              {formatTime(remainingTime)}
            </span>
          </div>
          {!isLocked && (
            <div className="status-item">
              <span className="status-label">Attempts left:</span>
              <span className={`status-value ${remainingAttempts === 1 ? 'danger' : ''}`}>
                {remainingAttempts}
              </span>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || isLocked || otp.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          {onBack && (
            <button
              type="button"
              className="back-btn"
              onClick={onBack}
              disabled={loading}
            >
              Back
            </button>
          )}
        </div>

        <div className="resend-section">
          <p>Didn&apos;t receive the code?</p>
          <button
            type="button"
            className="resend-btn"
            onClick={requestNewOtp}
            disabled={loading}
          >
            Request New OTP
          </button>
        </div>
      </form>

    </div>
  );
};

export default OtpEntry;

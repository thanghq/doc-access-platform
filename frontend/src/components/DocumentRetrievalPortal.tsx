import React, { useState } from 'react';
import '../styles/DocumentRetrievalPortal.css';
import VerificationForm from './VerificationForm';
import OtpEntry from './OtpEntry';
import DownloadPage from './DownloadPage';

type PortalStep = 'verification' | 'otp' | 'download';

export const DocumentRetrievalPortal: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<PortalStep>('verification');
  const [requestUUID, setRequestUUID] = useState('');
  const [requestorEmail, setRequestorEmail] = useState('');
  const [downloadSessionToken, setDownloadSessionToken] = useState('');

  const handleVerificationSuccess = (uuid: string, email: string) => {
    setRequestUUID(uuid);
    setRequestorEmail(email);
    setCurrentStep('otp');
  };

  const handleOtpSuccess = (sessionToken: string) => {
    setDownloadSessionToken(sessionToken);
    setCurrentStep('download');
  };

  const handleSessionExpired = () => {
    setCurrentStep('verification');
    setRequestUUID('');
    setRequestorEmail('');
    setDownloadSessionToken('');
  };

  return (
    <div className="document-retrieval-portal">
      <div className="portal-progress">
        <div className={`step ${currentStep === 'verification' ? 'active' : 'complete'}`}>
          <div className="step-number">1</div>
          <div className="step-label">Verification</div>
        </div>
        <div className="step-divider"></div>
        <div className={`step ${currentStep === 'otp' ? 'active' : currentStep === 'download' ? 'complete' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">OTP</div>
        </div>
        <div className="step-divider"></div>
        <div className={`step ${currentStep === 'download' ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Download</div>
        </div>
      </div>

      <div className="portal-content">
        {currentStep === 'verification' && (
          <VerificationForm
            onSuccess={handleVerificationSuccess}
            onCancel={() => {
              window.location.href = '/catalog';
            }}
          />
        )}

        {currentStep === 'otp' && (
          <OtpEntry
            requestUUID={requestUUID}
            requestorEmail={requestorEmail}
            onSuccess={handleOtpSuccess}
            onBack={() => setCurrentStep('verification')}
          />
        )}

        {currentStep === 'download' && (
          <DownloadPage
            downloadSessionToken={downloadSessionToken}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentRetrievalPortal;

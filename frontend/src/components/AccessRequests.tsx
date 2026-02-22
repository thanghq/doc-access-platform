import React, { useState } from 'react';
import AccessRequestsList from './AccessRequestsList';
import AccessRequestsHistory from './AccessRequestsHistory';
import AuditTrail from './AuditTrail';
import '../styles/AccessRequests.css';


const AccessRequests: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'audit'>('pending');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTabChange = (tab: 'pending' | 'history' | 'audit') => {
    setActiveTab(tab);
  };

  const handleRequestActionCompleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="access-requests-container">
      <div className="access-requests-header">
        <h1>Access Request Management</h1>
        <p>Review, approve, deny, and revoke access requests for your documents</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => handleTabChange('pending')}
        >
          Pending Requests
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleTabChange('history')}
        >
          History
        </button>
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => handleTabChange('audit')}
        >
          Audit Trail
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'pending' && (
          <AccessRequestsList
            onActionCompleted={handleRequestActionCompleted}
            refreshTrigger={refreshTrigger}
          />
        )}
        {activeTab === 'history' && (
          <AccessRequestsHistory refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'audit' && (
          <AuditTrail refreshTrigger={refreshTrigger} />
        )}
      </div>
    </div>
  );
};

export default AccessRequests;

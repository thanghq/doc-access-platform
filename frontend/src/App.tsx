import React, { useState, useEffect } from 'react';
import PublicCatalog from './components/PublicCatalog';
import DocumentRetrievalPortal from './components/DocumentRetrievalPortal';
import DocumentList from './components/DocumentList';
import DocumentUpload from './components/DocumentUpload';
import AccessRequests from './components/AccessRequests';
import Login from './components/Login';
import { authService } from './services/authService';
import './styles/App.css';

type ViewType = 'public-catalog' | 'retrieval-portal' | 'owner-dashboard' | 'access-requests' | 'login';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('public-catalog');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Start as true to check on mount
  const [userEmail, setUserEmail] = useState<string>('');
  const [hasInitiallyChecked, setHasInitiallyChecked] = useState(false);

  // Check authentication status on initial mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Check auth when navigating to protected views
  useEffect(() => {
    if (currentView === 'owner-dashboard' || currentView === 'access-requests') {
      if (!isAuthenticated && !isCheckingAuth) {
        checkAuthStatus();
      }
    }
  }, [currentView]);

  // Track when initial auth check is complete
  useEffect(() => {
    if (!isCheckingAuth && !hasInitiallyChecked) {
      setHasInitiallyChecked(true);
    }
  }, [isCheckingAuth, hasInitiallyChecked]);

  const checkAuthStatus = async () => {
    setIsCheckingAuth(true);
    try {
      const session = await authService.getSession();
      setIsAuthenticated(session.isAuthenticated);
      setUserEmail(session.email || '');
      
      // If not authenticated and trying to access protected view, show login
      if (!session.isAuthenticated && (currentView === 'owner-dashboard' || currentView === 'access-requests')) {
        setCurrentView('login');
      }
    } catch (error) {
      setIsAuthenticated(false);
      if (currentView === 'owner-dashboard' || currentView === 'access-requests') {
        setCurrentView('login');
      }
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLoginSuccess = async () => {
    await checkAuthStatus();
    setCurrentView('owner-dashboard');
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUserEmail('');
      setShowUploadForm(false);
      setCurrentView('public-catalog');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadForm(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleNavigate = (view: ViewType) => {
    if (view === 'owner-dashboard' || view === 'access-requests') {
      // Protected views - check authentication first
      if (!isAuthenticated) {
        setCurrentView('login');
        return;
      }
    }
    setCurrentView(view);
    setShowUploadForm(false);
  };

  // Show loading screen on initial mount while checking auth
  if (!hasInitiallyChecked) {
    return (
      <div className="app-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Render login page
  if (currentView === 'login') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div>
            <h1>Document Access Platform</h1>
          </div>
          <div className="header-actions">
            <button
              className="btn-secondary"
              onClick={() => setCurrentView('public-catalog')}
            >
              Back to Catalog
            </button>
          </div>
        </header>
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>Document Access Platform</h1>
          {isAuthenticated && userEmail && (
            <p className="user-info">Logged in as: {userEmail}</p>
          )}
        </div>
        <div className="header-actions">
          {isAuthenticated && currentView === 'owner-dashboard' && (
            <button
              className="btn-primary"
              onClick={() => setShowUploadForm(!showUploadForm)}
            >
              {showUploadForm ? 'Cancel' : 'Upload Document'}
            </button>
          )}
          {!isAuthenticated ? (
            <button
              className="btn-primary"
              onClick={() => setCurrentView('login')}
            >
              Owner Login
            </button>
          ) : (
            <button className="btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-tab ${currentView === 'public-catalog' ? 'active' : ''}`}
          onClick={() => handleNavigate('public-catalog')}
        >
          Public Catalog
        </button>
        <button
          className={`nav-tab ${currentView === 'retrieval-portal' ? 'active' : ''}`}
          onClick={() => handleNavigate('retrieval-portal')}
        >
          Document Retrieval
        </button>
        {isAuthenticated && (
          <>
            <button
              className={`nav-tab ${currentView === 'owner-dashboard' ? 'active' : ''}`}
              onClick={() => handleNavigate('owner-dashboard')}
            >
              Owner Dashboard
            </button>
            <button
              className={`nav-tab ${currentView === 'access-requests' ? 'active' : ''}`}
              onClick={() => handleNavigate('access-requests')}
            >
              Access Requests
            </button>
          </>
        )}
      </nav>

      {isCheckingAuth && (
        <div className="loading-overlay">
          <div className="loading">Checking authentication...</div>
        </div>
      )}

      {showUploadForm && currentView === 'owner-dashboard' && (
        <DocumentUpload onUploadSuccess={handleUploadSuccess} />
      )}

      <main className="app-main">
        {currentView === 'public-catalog' && <PublicCatalog />}
        {currentView === 'retrieval-portal' && <DocumentRetrievalPortal />}
        {currentView === 'owner-dashboard' && isAuthenticated && (
          <DocumentList refreshTrigger={refreshTrigger} />
        )}
        {currentView === 'access-requests' && isAuthenticated && (
          <AccessRequests />
        )}
      </main>
    </div>
  );
}

export default App;

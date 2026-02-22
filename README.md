# Document Access Platform

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication & Security](#authentication-and-security)
- [Architecture](#architecture)
- [Trade-offs & Future Improvements](#trade-offs--future-improvements)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker
- Git
- MySQL 8.0+ (if running locally without Docker)
- Nodejs v20+ (if running locally without Docker)

### Option 1: Using docker-compose (Recommended)

```bash
# Clone and navigate to project
cd doc-access-platform

# Start all services
docker-compose up -d

# Wait for all containers then run this seed command
docker exec -it doc-access-platform-backend sh -c "npm run seed"
```
Access the application at `http://localhost:3000`


### Option 2: Manual Setup

**Mysql:**
Self install your mysql instance and make sure it can be connected.

**Backend:**
```bash
cd backend
cp .env.example .env # Do update your db connection/credential 
npm install
npm run db:migration:run  # Set up database schema
npm run seed # Add seed data
npm run start:dev
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

The frontend will open at `http://localhost:3000` with the API at `http://localhost:3001/api`.

### Verifying Seed Data

After running the seed script, verify the account:

1. Navigate to `http://localhost:3000`
2. Click "Login" or access the login page
3. Enter email: `user1@email.com`
4. Enter password: `password1`
5. You should be authenticated and able to access the `Document Owner Dashboard`


### Clean-up After Run:

```bash
docker-compose down # Tear down all container and network
docker-compose down -v # Remove volume

rm -rf backend/storage/* # Delete all uploaded files
```

## Authentication And Security

### Session-Based Authentication

The application uses secure session-based authentication with HTTP-only cookies:

- **Session Management**: Express-session with secure cookies
- **Password Hashing**: Bcrypt with salt rounds (10)
- **Session Validity**: 24 hours with automatic expiration
- **CSRF Protection**: SameSite cookie attribute
- **Secure in Production**: Cookies marked as secure in production environment

### Authentication Flow

1. User submits email and password via login form
2. Backend validates credentials (email normalization, password verification)
3. On success, creates secure session with HTTP-only cookie
4. Session token automatically included in subsequent requests
5. Protected routes check session validity via AuthGuard
6. Logout destroys session and clears cookies

### Security Features

- **Generic Error Messages**: "Invalid email or password" prevents username enumeration
- **Case-Insensitive Email**: Email addresses normalized to lowercase
- **Whitespace Trimming**: Leading/trailing spaces removed from email input
- **Password Security**: Passwords hashed with bcrypt, never stored in plaintext
- **Session Validation**: Every protected route validates active session
- **Guest User Restrictions**: Unauthenticated users can only access to `Public Catalog` and `Document Retrieval` pages

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
├─────────────────────────────────────────────────────────────┤
│           React Frontend (TypeScript)                       │
│  - Login/Authentication                                     │
│  - Session Management                                       │
│  - Document List & Search                                   │
│  - File Upload                                              │
│  - Visibility Management                                    │
│  - Access Grant Viewing                                     │
│  - Access Request Management                                │
│  - Approval/Denial Dialogs                                  │
│  - Audit Trail Viewing                                      │
└─────────────────────────────────────────────────────────────┘
                           ↑↓ HTTP/REST (with session cookies)
┌─────────────────────────────────────────────────────────────┐
│              NestJS Backend (TypeScript)                    │
│  - AuthService & AuthController                             │
│  - AuthGuard (session validation)                           │
│  - DocumentService (business logic)                         │
│  - FileStorageService (file operations)                     │
│  - DocumentController (HTTP routing)                        │
│  - Access Management Service Methods                        │
│  - Email Notification Logging                               │
│  - Error handling & validation                              │
└─────────────────────────────────────────────────────────────┘
                           ↑↓ MySQL Protocol
┌─────────────────────────────────────────────────────────────┐
│                    MySQL Database                           │
│  - document_owners (user accounts + password hashes)        │
│  - document_files (document metadata)                       │
│  - access_grants (request tracking & decisions)             │
└─────────────────────────────────────────────────────────────┘

                      File Storage
                     /storage/{ownerID}/
                  
```

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Axios for API communication
- CSS for styling
- File upload handling

**Backend:**
- NestJS 
- TypeORM
- MySQL 8.0
- Bcrypt for password hashing
- Passport.js (with Local strategy support)
- Multer for file upload

**Infrastructure:**
- Docker & Docker Compose for containerization
- Persistent volumes for database and file storage

## Trade-offs & Future Improvements

### Current Limitations

#### Authentication & Authorization
**Current Implementation:** Session-based authentication with bcrypt password hashing
- **Strengths:** Simple, secure for single-server deployments, HTTP-only cookies prevent XSS
- **Limitations:** Not suitable for distributed/multi-server architectures without shared session store
- **In Production:** Consider JWT tokens with refresh tokens for scalability, or implement Redis session store for distributed systems
- **Future Enhancement:** Add OAuth2/OIDC for social login, multi-factor authentication (MFA)

#### Access Expiry Enforcement
**Trade-off:** Server-side expiry check during request authorization (not automatic cleanup)
- **Why:** Simpler implementation, avoids complex scheduled jobs
- **In Production:** Implement scheduled jobs to clean up expired grants
- **Impact:** Expired records remain in database; access is denied at request time

#### File Storage
**Trade-off:** Local filesystem storage during development
- **Why:** Simple setup, no external dependencies
- **In Production:** Migrate to S3, Azure Blob Storage, or similar
- **Impact:** Single-server only, no redundancy

#### Soft Deletion Only
**Trade-off:** Documents marked deleted but not permanently removed
- **Why:** Data recovery and audit trail preservation
- **In Production:** Implement permanent deletion after retention period
- **Enhancement:** Add retention policy management

### Areas for Enhancement

1. **Access Management Improvements**
   - Automatic expiry enforcement via scheduled tasks
   - Access request notifications to requestors (when request submitted)

2. **Performance Optimization**
   - Implement lazy loading for large lists
   - Batch operations for multiple file management

2. **Security Improvements**
   - Use JWT instead of session for scalability
   - Encryption at rest for uploaded files
   - Implement rate limiting
   - Add CSRF protection
   - Input sanitization for descriptions

3. **User Experience**
   - Drag-and-drop file upload
   - Bulk operations (delete, visibility toggle)
   - Document tagging/categorization
   - Advanced search with date ranges

4. **Operational Features**
   - Change password feature
   - Add/Remove Document Owner
   - Admin dashboard for platform oversight
   - Automated cleanup of expired access grants
   - Document versioning support

5. **Testing Enhancements**
   - E2E tests with Cypress or Playwright
   - Performance/load testing
   - Security penetration testing

## Troubleshooting

### Database Connection Issues
```bash
# Check MySQL container status
docker ps | grep mysql

# View MySQL logs
docker logs doc-access-platform-db

# Reset database
docker-compose down -v
docker-compose up -d
```

### Port Already in Use
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>
# Or change port in docker-compose.yml
```

### File Upload Failures
- Verify file type is PDF, XLSX, or DOCX
- Check file size is under 100 MB
- Ensure storage directory has write permissions
- Check server logs for specific error

### Frontend Can't Connect to API
- Verify backend is running on port 3001
- Check `REACT_APP_API_URL` in `.env`
- Verify CORS is enabled (check backend logs)
- Browser console for network errors

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentService } from '../src/services/document.service';
import { DocumentFile, VisibilityStatus, FileType } from '../src/entities/document-file.entity';
import { AccessGrant, AccessStatus } from '../src/entities/access-grant.entity';
import { DocumentOwner } from '../src/entities/document-owner.entity';
import { FileStorageService } from '../src/services/file-storage.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DocumentService - Access Management', () => {
  let service: DocumentService;
  let documentRepository: Repository<DocumentFile>;
  let accessGrantRepository: Repository<AccessGrant>;
  let ownerRepository: Repository<DocumentOwner>;
  let fileStorageService: FileStorageService;

  const mockOwnerId = 'owner-123';
  const mockDocumentId = 'doc-123';
  const mockGrantId = 'grant-123';

  const mockOwner: DocumentOwner = {
    id: mockOwnerId,
    email: 'owner@example.com',
    name: 'Document Owner',
    organization: 'Test Org',
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockDocument: DocumentFile = {
    id: mockDocumentId,
    filename: 'test-document.pdf',
    fileType: FileType.PDF,
    fileSize: 1024,
    storagePath: '/storage/test.pdf',
    visibilityStatus: VisibilityStatus.HIDDEN,
    description: 'Test document',
    owner: mockOwner,
    ownerId: mockOwnerId,
    accessGrants: [],
    uploadedAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    isActive: () => true,
  } as any;

  const mockAccessGrant: AccessGrant = {
    id: mockGrantId,
    documentId: mockDocumentId,
    document: mockDocument,
    requestorEmail: 'requestor@example.com',
    requestorName: 'John Doe',
    requestorOrganization: 'External Company',
    requestPurpose: 'Review contract',
    accessToken: 'token-123',
    status: AccessStatus.PENDING,
    expiryDate: null,
    denialReason: null,
    approvalMessage: null,
    revocationMessage: null,
    actionCompletedAt: null,
    otp: null,
    otpExpiryDate: null,
    otpAttempts: 0,
    isVerified: false,
    verifiedAt: null,
    downloadSessionToken: null,
    lastActivityAt: null,
    requestedAt: new Date(),
    updatedAt: new Date(),
    isActive: () => false,
    isExpired: () => false,
    isOtpExpired: () => true,
    canRequestOtp: () => false,
    canVerifyOtp: () => false,
    isSessionActive: () => false,
  } as any;

  beforeEach(async () => {
    // Reset mocks to prevent state leakage between tests
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: getRepositoryToken(DocumentFile),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccessGrant),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DocumentOwner),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: {
            validateAndStoreFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    documentRepository = module.get<Repository<DocumentFile>>(
      getRepositoryToken(DocumentFile),
    );
    accessGrantRepository = module.get<Repository<AccessGrant>>(
      getRepositoryToken(AccessGrant),
    );
    ownerRepository = module.get<Repository<DocumentOwner>>(
      getRepositoryToken(DocumentOwner),
    );
    fileStorageService = module.get<FileStorageService>(FileStorageService);
  });

  describe('approveAccessRequest', () => {
    it('should approve a pending access request with expiry date', async () => {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue(mockAccessGrant);
      jest.spyOn(accessGrantRepository, 'save').mockResolvedValue({
        ...mockAccessGrant,
        status: AccessStatus.APPROVED,
        expiryDate,
      } as any);

      const result = await service.approveAccessRequest(
        mockDocumentId,
        mockGrantId,
        mockOwnerId,
        {
          expiryDate: expiryDate.toISOString().split('T')[0],
          message: 'Approved for review',
        },
      );

      expect(result.status).toBe(AccessStatus.APPROVED);
      expect(accessGrantRepository.save).toHaveBeenCalled();
    });

    it('should reject approval with past expiry date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue(mockAccessGrant);

      await expect(
        service.approveAccessRequest(mockDocumentId, mockGrantId, mockOwnerId, {
          expiryDate: pastDate.toISOString().split('T')[0],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if document not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.approveAccessRequest(mockDocumentId, mockGrantId, mockOwnerId, {
          expiryDate: new Date().toISOString().split('T')[0],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if access grant not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.approveAccessRequest(mockDocumentId, mockGrantId, mockOwnerId, {
          expiryDate: new Date().toISOString().split('T')[0],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('denyAccessRequest', () => {
    it('should deny a pending access request', async () => {
      const pendingGrant = { ...mockAccessGrant, status: AccessStatus.PENDING } as any;
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue(pendingGrant);
      jest.spyOn(accessGrantRepository, 'save').mockResolvedValue({
        ...mockAccessGrant,
        status: AccessStatus.DENIED,
        denialReason: 'Insufficient access rights',
      } as any);

      const result = await service.denyAccessRequest(
        mockDocumentId,
        mockGrantId,
        mockOwnerId,
        { reason: 'Insufficient access rights' },
      );

      expect(result.status).toBe(AccessStatus.DENIED);
      expect(accessGrantRepository.save).toHaveBeenCalled();
    });

    it('should deny without reason', async () => {
      const pendingGrant = { ...mockAccessGrant, status: AccessStatus.PENDING } as any;
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue(pendingGrant);
      jest.spyOn(accessGrantRepository, 'save').mockResolvedValue({
        ...mockAccessGrant,
        status: AccessStatus.DENIED,
      } as any);

      const result = await service.denyAccessRequest(
        mockDocumentId,
        mockGrantId,
        mockOwnerId,
      );

      expect(result.status).toBe(AccessStatus.DENIED);
    });
  });

  describe('revokeAccessGrant', () => {
    it('should revoke an active access grant', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue({
        ...mockAccessGrant,
        status: AccessStatus.APPROVED,
      } as any);
      jest.spyOn(accessGrantRepository, 'save').mockResolvedValue({
        ...mockAccessGrant,
        status: AccessStatus.REVOKED,
      } as any);

      await service.revokeAccessGrant(
        mockDocumentId,
        mockGrantId,
        mockOwnerId,
        { message: 'Project cancelled' },
      );

      expect(accessGrantRepository.save).toHaveBeenCalled();
    });

    it('should throw error if grant not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.revokeAccessGrant(mockDocumentId, mockGrantId, mockOwnerId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAccessRequests', () => {
    it('should list pending access requests for owner', async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAccessGrant], 1]),
      };

      jest
        .spyOn(accessGrantRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);
      jest
        .spyOn(documentRepository, 'find')
        .mockResolvedValue([mockDocument]);

      const result = await service.listAccessRequests(mockOwnerId, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('getAccessGrantsForFile', () => {
    it('should categorize grants into active, expired, and revoked', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const activeGrant = {
        ...mockAccessGrant,
        status: AccessStatus.APPROVED,
        expiryDate: tomorrow,
        isActive: () => true,
        isExpired: () => false,
      } as any;

      const expiredGrant = {
        ...mockAccessGrant,
        id: 'grant-2',
        status: AccessStatus.APPROVED,
        expiryDate: yesterday,
        isActive: () => false,
        isExpired: () => true,
      } as any;

      const revokedGrant = {
        ...mockAccessGrant,
        id: 'grant-3',
        status: AccessStatus.REVOKED,
        isActive: () => false,
        isExpired: () => false,
      } as any;

      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest
        .spyOn(accessGrantRepository, 'find')
        .mockResolvedValue([activeGrant, expiredGrant, revokedGrant]);

      const result = await service.getAccessGrantsForFile(
        mockDocumentId,
        mockOwnerId,
      );

      expect(result.active).toHaveLength(1);
      expect(result.expired).toHaveLength(1);
      expect(result.revoked).toHaveLength(1);
    });
  });

  describe('bulkRevokeAccess', () => {
    it('should revoke all active access grants for a file', async () => {
      const approvedGrant = {
        ...mockAccessGrant,
        status: AccessStatus.APPROVED,
        isExpired: () => false,
      } as any;

      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);
      jest
        .spyOn(accessGrantRepository, 'find')
        .mockResolvedValue([approvedGrant]);
      jest.spyOn(accessGrantRepository, 'save').mockResolvedValue(approvedGrant);

      await service.bulkRevokeAccess(mockDocumentId, mockOwnerId, {
        message: 'Sensitive content deleted',
      });

      expect(accessGrantRepository.save).toHaveBeenCalled();
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail entries for owner', async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            ...mockAccessGrant,
            status: AccessStatus.APPROVED,
          },
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };

      jest
        .spyOn(accessGrantRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);
      jest
        .spyOn(documentRepository, 'find')
        .mockResolvedValue([mockDocument]);

      const result = await service.getAuditTrail(mockOwnerId, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { DocumentService } from '../src/services/document.service';
import { FileStorageService } from '../src/services/file-storage.service';
import { DocumentFile, VisibilityStatus, FileType } from '../src/entities/document-file.entity';
import { DocumentOwner } from '../src/entities/document-owner.entity';
import { AccessGrant, AccessStatus } from '../src/entities/access-grant.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DocumentService', () => {
  let service: DocumentService;
  let documentRepository: Repository<DocumentFile>;
  let ownerRepository: Repository<DocumentOwner>;
  let accessGrantRepository: Repository<AccessGrant>;
  let fileStorageService: FileStorageService;

  const mockOwner: DocumentOwner = {
    id: 'owner-123',
    email: 'owner@test.com',
    name: 'Test Owner',
    organization: 'Test Org',
    passwordHash: 'hashed_password',
    isActive: true,
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDocument: DocumentFile = {
    id: 'doc-123',
    filename: 'test.pdf',
    fileType: FileType.PDF,
    fileSize: 1024,
    storagePath: '/storage/test.pdf',
    visibilityStatus: VisibilityStatus.PUBLIC,
    description: 'Test document',
    owner: mockOwner,
    ownerId: mockOwner.id,
    accessGrants: [],
    uploadedAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    isActive: () => true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: getRepositoryToken(DocumentFile),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
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
          provide: getRepositoryToken(AccessGrant),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: {
            validateAndStoreFile: jest.fn(),
            deleteFile: jest.fn(),
            readFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    documentRepository = module.get<Repository<DocumentFile>>(
      getRepositoryToken(DocumentFile),
    );
    ownerRepository = module.get<Repository<DocumentOwner>>(
      getRepositoryToken(DocumentOwner),
    );
    accessGrantRepository = module.get<Repository<AccessGrant>>(
      getRepositoryToken(AccessGrant),
    );
    fileStorageService = module.get<FileStorageService>(FileStorageService);
  });

  describe('uploadDocument', () => {
    it('should successfully upload a document', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
        destination: '',
        filename: 'test.pdf',
        path: '/storage/test.pdf',
        stream: new Readable(),
      } as any;

      jest.spyOn(ownerRepository, 'findOne').mockResolvedValueOnce(mockOwner);
      jest.spyOn(fileStorageService, 'validateAndStoreFile').mockResolvedValueOnce({
        storagePath: '/storage/test.pdf',
        fileType: FileType.PDF,
        fileSize: 1024,
      });
      jest.spyOn(documentRepository, 'create').mockReturnValueOnce(mockDocument);
      jest.spyOn(documentRepository, 'save').mockResolvedValueOnce(mockDocument);

      const result = await service.uploadDocument(mockOwner.id, mockFile, {
        filename: 'test.pdf',
        fileType: FileType.PDF,
      });

      expect(result.filename).toBe('test.pdf');
      expect(result.fileType).toBe(FileType.PDF);
      expect(documentRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if owner not found', async () => {
      jest.spyOn(ownerRepository, 'findOne').mockResolvedValueOnce(null);

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
        destination: '',
        filename: 'test.pdf',
        path: '/storage/test.pdf',
        stream: new Readable(),
      } as any;

      await expect(
        service.uploadDocument('invalid-id', mockFile, {
          filename: 'test.pdf',
          fileType: FileType.PDF,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDocumentVisibility', () => {
    it('should successfully update document visibility to PUBLIC', async () => {
      const updatedDocument = { ...mockDocument, visibilityStatus: VisibilityStatus.PUBLIC, isActive: () => true };

      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(mockDocument);
      jest.spyOn(documentRepository, 'save').mockResolvedValueOnce(updatedDocument as any);

      const result = await service.updateDocumentVisibility(
        mockDocument.id,
        mockOwner.id,
        { visibilityStatus: VisibilityStatus.PUBLIC },
      );

      expect(result.visibilityStatus).toBe(VisibilityStatus.PUBLIC);
    });

    it('should throw NotFoundException if document not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.updateDocumentVisibility('invalid-id', mockOwner.id, {
          visibilityStatus: VisibilityStatus.PUBLIC,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if document is deleted', async () => {
      const deletedDocument = { ...mockDocument, deletedAt: new Date(), isActive: () => false };

      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(deletedDocument as any);

      await expect(
        service.updateDocumentVisibility(mockDocument.id, mockOwner.id, {
          visibilityStatus: VisibilityStatus.PUBLIC,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteDocument', () => {
    it('should successfully delete a document without active access grants', async () => {
      jest
        .spyOn(documentRepository, 'findOne')
        .mockResolvedValueOnce({ ...mockDocument, accessGrants: [], isActive: () => true } as any);
      jest.spyOn(documentRepository, 'save').mockResolvedValueOnce(mockDocument);
      jest.spyOn(fileStorageService, 'deleteFile').mockResolvedValueOnce(undefined);

      await service.deleteDocument(mockDocument.id, mockOwner.id);

      expect(documentRepository.save).toHaveBeenCalled();
      expect(fileStorageService.deleteFile).toHaveBeenCalledWith(mockDocument.storagePath);
    });

    it('should throw BadRequestException if document has active access grants', async () => {
      const activeAccessGrant: AccessGrant = {
        id: 'grant-123',
        documentId: mockDocument.id,
        document: mockDocument,
        requestorEmail: 'requestor@test.com',
        requestorName: 'Test Requestor',
        requestorOrganization: 'Test Org',
        requestPurpose: 'Testing',
        accessToken: 'token-123',
        status: AccessStatus.APPROVED,
        expiryDate: new Date(Date.now() + 86400000),
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
        isActive: () => true,
        isExpired: () => false,
        isOtpExpired: () => true,
        canRequestOtp: () => true,
        canVerifyOtp: () => false,
        isSessionActive: () => false,
      } as any;

      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce({
        ...mockDocument,
        accessGrants: [activeAccessGrant],
        isActive: () => true,
      } as any);

      await expect(
        service.deleteDocument(mockDocument.id, mockOwner.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if document not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.deleteDocument('invalid-id', mockOwner.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeAccessGrant', () => {
    it('should successfully revoke an access grant', async () => {
      const accessGrant: AccessGrant = {
        id: 'grant-123',
        documentId: mockDocument.id,
        document: mockDocument,
        requestorEmail: 'requestor@test.com',
        requestorName: 'Test Requestor',
        requestorOrganization: 'Test Org',
        requestPurpose: 'Testing',
        accessToken: 'token-123',
        status: AccessStatus.APPROVED,
        expiryDate: new Date(Date.now() + 86400000),
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
        isActive: () => true,
        isExpired: () => false,
        isOtpExpired: () => true,
        canRequestOtp: () => true,
        canVerifyOtp: () => false,
        isSessionActive: () => false,
      } as any;

      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValueOnce(accessGrant);
      jest.spyOn(accessGrantRepository, 'save').mockResolvedValueOnce(accessGrant);

      await service.revokeAccessGrant(mockDocument.id, accessGrant.id, mockOwner.id);

      expect(accessGrantRepository.save).toHaveBeenCalled();
      expect(accessGrant.status).toBe(AccessStatus.REVOKED);
    });

    it('should throw NotFoundException if document not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.revokeAccessGrant(mockDocument.id, 'grant-123', mockOwner.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if access grant not found', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValueOnce(mockDocument);
      jest.spyOn(accessGrantRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.revokeAccessGrant(mockDocument.id, 'invalid-grant-id', mockOwner.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

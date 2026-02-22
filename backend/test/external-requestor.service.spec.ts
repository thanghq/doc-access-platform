import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ExternalRequestorService } from '../src/services/external-requestor.service';
import { DocumentFile, VisibilityStatus, FileType } from '../src/entities/document-file.entity';
import { AccessGrant, AccessStatus } from '../src/entities/access-grant.entity';
import { DocumentOwner } from '../src/entities/document-owner.entity';
import { PublicDocumentsQueryDto } from '../src/dtos/external-requestor.dto';

describe('ExternalRequestorService', () => {
  let service: ExternalRequestorService;
  let documentRepository: Repository<DocumentFile>;
  let accessGrantRepository: Repository<AccessGrant>;

  const mockOwner: DocumentOwner = {
    id: 'owner-1',
    email: 'owner@example.com',
    name: 'Document Owner',
    organization: 'Test Organization',
    passwordHash: 'hashed_password',
    isActive: true,
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockPublicDocument: DocumentFile = {
    id: 'doc-1',
    filename: 'sample.pdf',
    fileType: FileType.PDF,
    fileSize: 1024000,
    description: 'Sample PDF document',
    visibilityStatus: VisibilityStatus.PUBLIC,
    uploadedAt: new Date('2024-01-15'),
    updatedAt: new Date(),
    deletedAt: null,
    storagePath: '/storage/sample.pdf',
    owner: mockOwner,
    ownerId: 'owner-1',
    accessGrants: [],
    isActive: () => true,
  } as any;

  const mockPrivateDocument: DocumentFile = {
    ...mockPublicDocument,
    id: 'doc-2',
    visibilityStatus: VisibilityStatus.HIDDEN,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalRequestorService,
        {
          provide: getRepositoryToken(DocumentFile),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccessGrant),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ExternalRequestorService>(ExternalRequestorService);
    documentRepository = module.get<Repository<DocumentFile>>(
      getRepositoryToken(DocumentFile),
    );
    accessGrantRepository = module.get<Repository<AccessGrant>>(
      getRepositoryToken(AccessGrant),
    );
  });

  describe('getPublicDocuments', () => {
    it('should return paginated public documents', async () => {
      const query: PublicDocumentsQueryDto = {
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[mockPublicDocument], 1]),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPublicDocuments(query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].filename).toBe('sample.pdf');
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter documents by search query', async () => {
      const query: PublicDocumentsQueryDto = {
        page: 1,
        limit: 10,
        query: 'sample',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[mockPublicDocument], 1]),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await service.getPublicDocuments(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'document.filename LIKE :search',
        { search: '%sample%' },
      );
    });

    it('should filter documents by file type', async () => {
      const query: PublicDocumentsQueryDto = {
        page: 1,
        limit: 10,
        fileTypes: ['PDF'],
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[mockPublicDocument], 1]),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await service.getPublicDocuments(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'document.fileType IN (:...fileTypes)',
        { fileTypes: ['PDF'] },
      );
    });

    it('should apply sorting', async () => {
      const query: PublicDocumentsQueryDto = {
        page: 1,
        limit: 10,
        sortBy: 'filename',
        sortOrder: 'ASC',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[mockPublicDocument], 1]),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await service.getPublicDocuments(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'document.filename',
        'ASC',
      );
    });
  });

  describe('getPublicDocumentDetail', () => {
    it('should return public document details', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockPublicDocument),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPublicDocumentDetail('doc-1');

      expect(result.filename).toBe('sample.pdf');
      expect(result.ownerId).toBe('owner-1');
    });

    it('should throw NotFoundException for private documents', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await expect(
        service.getPublicDocumentDetail('doc-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for deleted documents', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await expect(
        service.getPublicDocumentDetail('doc-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitAccessRequest', () => {
    it('should successfully submit access request', async () => {
      const submitDto = {
        requestorEmail: 'requestor@example.com',
        requestorName: 'John Doe',
        requestorOrganization: 'Acme Corp',
        requestPurpose: 'Business analysis',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockPublicDocument),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      jest
        .spyOn(accessGrantRepository, 'findOne')
        .mockResolvedValue(null);

      const mockAccessGrant = {
        id: 'grant-1',
        documentId: 'doc-1',
        document: mockPublicDocument,
        ...submitDto,
      };

      jest
        .spyOn(accessGrantRepository, 'create')
        .mockReturnValue(mockAccessGrant as any);

      jest
        .spyOn(accessGrantRepository, 'save')
        .mockResolvedValue(mockAccessGrant as any);

      const result = await service.submitAccessRequest('doc-1', submitDto);

      expect(result.requestUUID).toBeDefined();
      expect(result.status).toBe(AccessStatus.PENDING);
      expect(result.documentId).toBe('doc-1');
    });

    it('should throw ConflictException for duplicate pending request', async () => {
      const submitDto = {
        requestorEmail: 'requestor@example.com',
        requestorName: 'John Doe',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockPublicDocument),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const existingGrant = {
        id: 'existing-grant',
        status: AccessStatus.PENDING,
      };

      jest
        .spyOn(accessGrantRepository, 'findOne')
        .mockResolvedValue(existingGrant as any);

      await expect(
        service.submitAccessRequest('doc-1', submitDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-public documents', async () => {
      const submitDto = {
        requestorEmail: 'requestor@example.com',
        requestorName: 'John Doe',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      jest
        .spyOn(documentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await expect(
        service.submitAccessRequest('doc-2', submitDto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRequestStatus', () => {
    it('should return request status by UUID', async () => {
      const mockAccessGrant = {
        id: 'grant-1',
        documentId: 'doc-1',
        requestorEmail: 'requestor@example.com',
        requestorName: 'John Doe',
        status: AccessStatus.PENDING,
        requestedAt: new Date(),
        document: {
          filename: 'sample.pdf',
          owner: mockOwner,
        },
        isActive: jest.fn().mockReturnValue(false),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAccessGrant),
      };

      jest
        .spyOn(accessGrantRepository, 'createQueryBuilder' as any)
        .mockReturnValue(mockQueryBuilder as any);

      // Mock createQueryBuilder on repository
      (accessGrantRepository as any).createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const result = await service.getRequestStatus('token-123');

      expect(result.id).toBe('grant-1');
      expect(result.status).toBe(AccessStatus.PENDING);
      expect(result.filename).toBe('sample.pdf');
    });

    it('should throw NotFoundException for invalid UUID', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      (accessGrantRepository as any).createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      await expect(
        service.getRequestStatus('invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include accessUrl for approved active requests', async () => {
      const mockAccessGrant = {
        id: 'grant-1',
        documentId: 'doc-1',
        requestorEmail: 'requestor@example.com',
        requestorName: 'John Doe',
        status: AccessStatus.APPROVED,
        expiryDate: new Date(Date.now() + 86400000),
        requestedAt: new Date(),
        approvalMessage: 'You have access',
        document: {
          filename: 'sample.pdf',
          owner: mockOwner,
        },
        isActive: jest.fn().mockReturnValue(true),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAccessGrant),
      };

      (accessGrantRepository as any).createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const result = await service.getRequestStatus('token-123');

      expect(result.accessUrl).toBeDefined();
      expect(result.accessUrl).toContain('/access-token/');
    });
  });
});

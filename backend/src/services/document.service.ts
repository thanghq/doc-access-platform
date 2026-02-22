import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DocumentFile, VisibilityStatus, FileType } from '../entities/document-file.entity';
import { DocumentOwner } from '../entities/document-owner.entity';
import { AccessGrant, AccessStatus } from '../entities/access-grant.entity';
import {
  CreateDocumentDto,
  UpdateDocumentVisibilityDto,
  DocumentResponseDto,
  DocumentDetailDto,
  SearchDocumentsDto,
  PaginatedResponseDto,
} from '../dtos/document.dto';
import {
  ApproveAccessRequestDto,
  DenyAccessRequestDto,
  RevokeAccessGrantDto,
  AccessRequestListDto,
  AccessRequestResponseDto,
  AccessGrantDetailDto,
  ActiveAccessGrantsDto,
  AuditTrailEntryDto,
  AuditAction,
  BulkRevokeAccessDto,
} from '../dtos/access-management.dto';
import { FileStorageService } from './file-storage.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(DocumentFile)
    private documentRepository: Repository<DocumentFile>,
    @InjectRepository(DocumentOwner)
    private ownerRepository: Repository<DocumentOwner>,
    @InjectRepository(AccessGrant)
    private accessGrantRepository: Repository<AccessGrant>,
    private fileStorageService: FileStorageService,
  ) {}

  async uploadDocument(
    ownerId: string,
    file: any,
    createDocumentDto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const owner = await this.ownerRepository.findOne({ where: { id: ownerId } });
    if (!owner) {
      throw new NotFoundException('Document owner not found');
    }

    const { storagePath, fileType, fileSize } =
      await this.fileStorageService.validateAndStoreFile(file, ownerId);

    const document = this.documentRepository.create({
      filename: createDocumentDto.filename,
      fileType: fileType as FileType,
      fileSize,
      storagePath,
      description: createDocumentDto.description,
      owner,
      visibilityStatus: VisibilityStatus.HIDDEN,
    });

    const savedDocument = await this.documentRepository.save(document);
    return this.mapToDocumentResponseDto(savedDocument);
  }

  async getMyDocuments(
    ownerId: string,
    query: SearchDocumentsDto,
  ): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    const skip = (query.page - 1) * query.limit;

    let queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .where('document.ownerId = :ownerId', { ownerId })
      .where('document.deletedAt IS NULL')
      .leftJoinAndSelect('document.accessGrants', 'accessGrants');

    if (query.query) {
      queryBuilder = queryBuilder.andWhere('document.filename LIKE :search', {
        search: `%${query.query}%`,
      });
    }

    if (query.fileTypes && query.fileTypes.length > 0) {
      queryBuilder = queryBuilder.andWhere('document.fileType IN (:...fileTypes)', {
        fileTypes: query.fileTypes,
      });
    }

    const sortBy = query.sortBy || 'uploadedAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder = queryBuilder.orderBy(`document.${sortBy}`, sortOrder);

    const [documents, total] = await queryBuilder
      .skip(skip)
      .take(query.limit)
      .getManyAndCount();

    return {
      data: documents.map((doc) => this.mapToDocumentResponseDto(doc)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getDocumentDetail(
    documentId: string,
    ownerId: string,
  ): Promise<DocumentDetailDto> {
    const document = await this.documentRepository
      .createQueryBuilder('document')
      .where('document.id = :id', { id: documentId })
      .andWhere('document.ownerId = :ownerId', { ownerId })
      .andWhere('document.deletedAt IS NULL')
      .leftJoinAndSelect('document.owner', 'owner')
      .leftJoinAndSelect('document.accessGrants', 'accessGrants')
      .getOne();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: document.id,
      filename: document.filename,
      fileType: document.fileType,
      fileSize: document.fileSize,
      visibilityStatus: document.visibilityStatus,
      description: document.description ?? undefined,
      uploadedAt: document.uploadedAt,
      ownerId: document.owner.id,
      ownerEmail: document.owner.email,
      ownerName: document.owner.name,
      accessGrantsCount: document.accessGrants.length,
      activeAccessGrantsCount: document.accessGrants.filter((ag) =>
        ag.isActive(),
      ).length,
    };
  }

  async updateDocumentVisibility(
    documentId: string,
    ownerId: string,
    updateDto: UpdateDocumentVisibilityDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.isActive()) {
      throw new BadRequestException('Cannot update deleted document');
    }

    document.visibilityStatus = updateDto.visibilityStatus;
    const updatedDocument = await this.documentRepository.save(document);
    return this.mapToDocumentResponseDto(updatedDocument);
  }

  async deleteDocument(documentId: string, ownerId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
      relations: ['accessGrants'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const activeAccessGrants = document.accessGrants.filter(
      (ag) => ag.status === AccessStatus.APPROVED && ag.isActive(),
    );

    if (activeAccessGrants.length > 0) {
      throw new BadRequestException(
        'Cannot delete file with active access grants. Revoke all access before deleting.',
      );
    }

    document.deletedAt = new Date();
    await this.documentRepository.save(document);

    await this.fileStorageService.deleteFile(document.storagePath);
  }

  async revokeAccessGrant(
    documentId: string,
    accessGrantId: string,
    ownerId: string,
    revokeDto?: RevokeAccessGrantDto,
  ): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const accessGrant = await this.accessGrantRepository.findOne({
      where: { id: accessGrantId, documentId },
    });

    if (!accessGrant) {
      throw new NotFoundException('Access grant not found');
    }

    accessGrant.status = AccessStatus.REVOKED;
    if (revokeDto?.message) {
      accessGrant.revocationMessage = revokeDto.message;
    }
    accessGrant.actionCompletedAt = new Date();
    await this.accessGrantRepository.save(accessGrant);

    const message = revokeDto?.message
      ? `Your access to ${document.filename} has been revoked. Reason: ${revokeDto.message}`
      : `Your access to ${document.filename} has been revoked`;
    this.sendMockNotification(accessGrant.requestorEmail, message);
  }

  async approveAccessRequest(
    documentId: string,
    accessGrantId: string,
    ownerId: string,
    approveDto: ApproveAccessRequestDto,
  ): Promise<AccessRequestResponseDto> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const accessGrant = await this.accessGrantRepository.findOne({
      where: { id: accessGrantId, documentId },
    });

    if (!accessGrant) {
      throw new NotFoundException('Access grant not found');
    }

    if (accessGrant.status !== AccessStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve request with status ${accessGrant.status}`,
      );
    }

    const expiryDate = new Date(approveDto.expiryDate);
    const now = new Date();

    if (expiryDate <= now) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    accessGrant.status = AccessStatus.APPROVED;
    accessGrant.expiryDate = expiryDate;
    if (approveDto.message) {
      accessGrant.approvalMessage = approveDto.message;
    }
    accessGrant.actionCompletedAt = new Date();
    await this.accessGrantRepository.save(accessGrant);

    let emailMessage = `Your access request for ${document.filename} has been approved. Access expires on ${expiryDate.toISOString().split('T')[0]}`;
    if (approveDto.message) {
      emailMessage += `\n\nMessage from owner: ${approveDto.message}`;
    }
    this.sendMockNotification(accessGrant.requestorEmail, emailMessage);

    return this.mapToAccessRequestResponseDto(accessGrant, document);
  }

  async denyAccessRequest(
    documentId: string,
    accessGrantId: string,
    ownerId: string,
    denyDto?: DenyAccessRequestDto,
  ): Promise<AccessRequestResponseDto> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const accessGrant = await this.accessGrantRepository.findOne({
      where: { id: accessGrantId, documentId },
    });

    if (!accessGrant) {
      throw new NotFoundException('Access grant not found');
    }

    if (accessGrant.status !== AccessStatus.PENDING) {
      throw new BadRequestException(
        `Cannot deny request with status ${accessGrant.status}`,
      );
    }

    accessGrant.status = AccessStatus.DENIED;
    if (denyDto?.reason) {
      accessGrant.denialReason = denyDto.reason;
    }
    accessGrant.actionCompletedAt = new Date();
    await this.accessGrantRepository.save(accessGrant);

    let emailMessage = `Your access request for ${document.filename} has been denied`;
    if (denyDto?.reason) {
      emailMessage += `\n\nReason: ${denyDto.reason}`;
    }
    this.sendMockNotification(accessGrant.requestorEmail, emailMessage);

    return this.mapToAccessRequestResponseDto(accessGrant, document);
  }

  async listAccessRequests(
    ownerId: string,
    query: AccessRequestListDto,
  ): Promise<PaginatedResponseDto<AccessRequestResponseDto>> {
    const skip = (query.page - 1) * query.limit;

    let queryBuilder = this.accessGrantRepository
      .createQueryBuilder('ag')
      .innerJoin('ag.document', 'document')
      .where('document.ownerId = :ownerId', { ownerId })
      .andWhere('ag.status = :status', { status: AccessStatus.PENDING });

    if (query.searchEmail) {
      queryBuilder = queryBuilder.andWhere(
        'ag.requestorEmail LIKE :email',
        { email: `%${query.searchEmail}%` },
      );
    }

    if (query.filterFilename) {
      queryBuilder = queryBuilder.andWhere(
        'document.filename LIKE :filename',
        { filename: `%${query.filterFilename}%` },
      );
    }

    queryBuilder = queryBuilder.orderBy('ag.requestedAt', 'DESC');

    const [requests, total] = await queryBuilder
      .skip(skip)
      .take(query.limit)
      .getManyAndCount();

    const documentIds = requests.map((r) => r.documentId);
    const documents = documentIds.length > 0 
      ? await this.documentRepository.find({
          where: {
            id: In(documentIds),
          },
        })
      : [];

    const documentMap = new Map(documents.map((d) => [d.id, d]));

    return {
      data: requests.map((req) =>
        this.mapToAccessRequestResponseDto(req, documentMap.get(req.documentId)!),
      ),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async listAccessRequestHistory(
    ownerId: string,
    query: AccessRequestListDto,
  ): Promise<PaginatedResponseDto<AccessRequestResponseDto>> {
    const skip = (query.page - 1) * query.limit;

    let queryBuilder = this.accessGrantRepository
      .createQueryBuilder('ag')
      .innerJoin('ag.document', 'document')
      .where('document.ownerId = :ownerId', { ownerId })
      .andWhere('ag.status IN (:...statuses)', {
        statuses: [AccessStatus.APPROVED, AccessStatus.DENIED, AccessStatus.REVOKED],
      });

    if (query.searchEmail) {
      queryBuilder = queryBuilder.andWhere(
        'ag.requestorEmail LIKE :email',
        { email: `%${query.searchEmail}%` },
      );
    }

    if (query.filterFilename) {
      queryBuilder = queryBuilder.andWhere(
        'document.filename LIKE :filename',
        { filename: `%${query.filterFilename}%` },
      );
    }

    if (query.filterStatus) {
      queryBuilder = queryBuilder.andWhere('ag.status = :filterStatus', {
        filterStatus: query.filterStatus,
      });
    }

    queryBuilder = queryBuilder.orderBy('ag.actionCompletedAt', 'DESC');

    const [requests, total] = await queryBuilder
      .skip(skip)
      .take(query.limit)
      .getManyAndCount();

    const documentIds = requests.map((r) => r.documentId);
    const documents = documentIds.length > 0
      ? await this.documentRepository.find({
          where: {
            id: In(documentIds),
          },
        })
      : [];

    const documentMap = new Map(documents.map((d) => [d.id, d]));

    return {
      data: requests.map((req) =>
        this.mapToAccessRequestResponseDto(req, documentMap.get(req.documentId)!),
      ),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getAccessGrantsForFile(
    documentId: string,
    ownerId: string,
  ): Promise<ActiveAccessGrantsDto> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const accessGrants = await this.accessGrantRepository.find({
      where: { documentId },
      order: { requestedAt: 'DESC' },
    });

    const now = new Date();

    const active: AccessGrantDetailDto[] = [];
    const expired: AccessGrantDetailDto[] = [];
    const revoked: AccessGrantDetailDto[] = [];

    for (const grant of accessGrants) {
      const dto: AccessGrantDetailDto = {
        id: grant.id,
        documentId: grant.documentId,
        filename: document.filename,
        requestorEmail: grant.requestorEmail,
        requestorName: grant.requestorName ?? undefined,
        status: grant.status,
        expiryDate: grant.expiryDate ?? undefined,
        requestedAt: grant.requestedAt,
        actionCompletedAt: grant.actionCompletedAt ?? undefined,
        isActive: grant.isActive(),
        isExpired: grant.isExpired(),
      };

      if (grant.status === AccessStatus.REVOKED) {
        revoked.push(dto);
      } else if (grant.status === AccessStatus.APPROVED && grant.isExpired()) {
        expired.push(dto);
      } else if (grant.isActive()) {
        active.push(dto);
      }
    }

    return { active, expired, revoked };
  }

  async bulkRevokeAccess(
    documentId: string,
    ownerId: string,
    bulkRevokeDto?: BulkRevokeAccessDto,
  ): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const activeGrants = await this.accessGrantRepository.find({
      where: {
        documentId,
        status: AccessStatus.APPROVED,
      },
    });

    const now = new Date();
    const grantsToRevoke = activeGrants.filter((ag) => !ag.isExpired());

    for (const grant of grantsToRevoke) {
      grant.status = AccessStatus.REVOKED;
      if (bulkRevokeDto?.message) {
        grant.revocationMessage = bulkRevokeDto.message;
      }
      grant.actionCompletedAt = new Date();
      await this.accessGrantRepository.save(grant);

      const message = bulkRevokeDto?.message
        ? `Your access to ${document.filename} has been revoked. Reason: ${bulkRevokeDto.message}`
        : `Your access to ${document.filename} has been revoked`;
      this.sendMockNotification(grant.requestorEmail, message);
    }
  }

  async getAuditTrail(
    ownerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponseDto<AuditTrailEntryDto>> {
    const skip = (page - 1) * limit;

    const accessGrants = await this.accessGrantRepository
      .createQueryBuilder('ag')
      .innerJoin('ag.document', 'document')
      .where('document.ownerId = :ownerId', { ownerId })
      .andWhere('ag.status IN (:...statuses)', {
        statuses: [AccessStatus.APPROVED, AccessStatus.DENIED, AccessStatus.REVOKED],
      })
      .orderBy('ag.actionCompletedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const total = await this.accessGrantRepository
      .createQueryBuilder('ag')
      .innerJoin('ag.document', 'document')
      .where('document.ownerId = :ownerId', { ownerId })
      .andWhere('ag.status IN (:...statuses)', {
        statuses: [AccessStatus.APPROVED, AccessStatus.DENIED, AccessStatus.REVOKED],
      })
      .getCount();

    const documentIds = accessGrants.map((ag) => ag.documentId);
    const documents = documentIds.length > 0
      ? await this.documentRepository.find({
          where: {
            id: In(documentIds),
          },
        })
      : [];

    const documentMap = new Map(documents.map((d) => [d.id, d]));

    const auditTrail = accessGrants.map((grant) => {
      const document = documentMap.get(grant.documentId)!;
      let action: AuditAction;
      let details = '';

      if (grant.status === AccessStatus.APPROVED) {
        action = AuditAction.REQUEST_APPROVED;
        details = `Approved until ${grant.expiryDate?.toISOString().split('T')[0]}`;
      } else if (grant.status === AccessStatus.DENIED) {
        action = AuditAction.REQUEST_DENIED;
        details = grant.denialReason || 'No reason provided';
      } else {
        action = AuditAction.REQUEST_REVOKED;
        details = grant.revocationMessage || 'No message provided';
      }

      const dto: AuditTrailEntryDto = {
        id: grant.id,
        action,
        documentId: document.id,
        filename: document.filename,
        requestorEmail: grant.requestorEmail,
        reason: grant.denialReason ?? undefined,
        message: grant.approvalMessage ?? grant.revocationMessage ?? undefined,
        timestamp: grant.actionCompletedAt || grant.updatedAt,
        details,
      };

      return dto;
    });

    return {
      data: auditTrail,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDocumentAccessGrants(
    documentId: string,
    ownerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<AccessGrant>> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ownerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const skip = (page - 1) * limit;
    const [accessGrants, total] = await this.accessGrantRepository
      .createQueryBuilder('ag')
      .where('ag.documentId = :documentId', { documentId })
      .orderBy('ag.requestedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: accessGrants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapToDocumentResponseDto(document: DocumentFile): DocumentResponseDto {
    const activeGrants = document.accessGrants
      ? document.accessGrants.filter((ag) => ag.isActive())
      : [];

    return {
      id: document.id,
      filename: document.filename,
      fileType: document.fileType,
      fileSize: document.fileSize,
      visibilityStatus: document.visibilityStatus,
      description: document.description ?? undefined,
      uploadedAt: document.uploadedAt,
      accessGrantsCount: document.accessGrants?.length || 0,
      activeAccessGrantsCount: activeGrants.length,
    };
  }

  private mapToAccessRequestResponseDto(
    grant: AccessGrant,
    document: DocumentFile,
  ): AccessRequestResponseDto {
    return {
      id: grant.id,
      documentId: grant.documentId,
      filename: document.filename,
      requestorEmail: grant.requestorEmail,
      requestorName: grant.requestorName ?? undefined,
      requestorOrganization: grant.requestorOrganization ?? undefined,
      requestPurpose: grant.requestPurpose,
      status: grant.status,
      expiryDate: grant.expiryDate ?? undefined,
      denialReason: grant.denialReason ?? undefined,
      approvalMessage: grant.approvalMessage ?? undefined,
      requestedAt: grant.requestedAt,
      actionCompletedAt: grant.actionCompletedAt ?? undefined,
    };
  }

  private sendMockNotification(email: string, message: string): void {
    this.logger.log(
      `[MOCK NOTIFICATION] Message sent to ${email}: ${message}`,
    );
  }
}

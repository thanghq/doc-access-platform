import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DocumentFile, VisibilityStatus } from '../entities/document-file.entity';
import { AccessGrant, AccessStatus } from '../entities/access-grant.entity';
import { PaginatedResponseDto } from '../dtos/document.dto';
import {
  PublicDocumentResponseDto,
  PublicDocumentDetailDto,
  PublicDocumentsQueryDto,
  SubmitAccessRequestDto,
  AccessRequestSubmissionResponseDto,
  RequestStatusResponseDto,
} from '../dtos/external-requestor.dto';

@Injectable()
export class ExternalRequestorService {
  private readonly logger = new Logger(ExternalRequestorService.name);

  constructor(
    @InjectRepository(DocumentFile)
    private documentRepository: Repository<DocumentFile>,
    @InjectRepository(AccessGrant)
    private accessGrantRepository: Repository<AccessGrant>,
  ) {}

  async getPublicDocuments(
    query: PublicDocumentsQueryDto,
  ): Promise<PaginatedResponseDto<PublicDocumentResponseDto>> {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    let queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .where('document.visibilityStatus = :status', {
        status: VisibilityStatus.PUBLIC,
      })
      .andWhere('document.deletedAt IS NULL')
      .leftJoinAndSelect('document.owner', 'owner')
      .leftJoinAndSelect('document.accessGrants', 'accessGrants');

    if (query.query) {
      queryBuilder = queryBuilder.andWhere('document.filename LIKE :search', {
        search: `%${query.query}%`,
      });
    }

    if (query.fileTypes) {
      // Ensure fileTypes is always an array (query params can come as string)
      const fileTypesArray = Array.isArray(query.fileTypes) 
        ? query.fileTypes 
        : [query.fileTypes];
      
      if (fileTypesArray.length > 0) {
        queryBuilder = queryBuilder.andWhere('document.fileType IN (:...fileTypes)', {
          fileTypes: fileTypesArray,
        });
      }
    }

    if (query.startDate && query.endDate) {
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);

      queryBuilder = queryBuilder.andWhere(
        'document.uploadedAt BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    const sortBy = query.sortBy || 'uploadedAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder = queryBuilder.orderBy(`document.${sortBy}`, sortOrder);

    const [documents, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: documents.map((doc) => this.mapToPublicDocumentDto(doc)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPublicDocumentDetail(
    documentId: string,
  ): Promise<PublicDocumentDetailDto> {
    const document = await this.documentRepository
      .createQueryBuilder('document')
      .where('document.id = :id', { id: documentId })
      .andWhere('document.visibilityStatus = :status', {
        status: VisibilityStatus.PUBLIC,
      })
      .andWhere('document.deletedAt IS NULL')
      .leftJoinAndSelect('document.owner', 'owner')
      .getOne();

    if (!document) {
      throw new NotFoundException('Document not found or is not publicly available');
    }

    return {
      id: document.id,
      ownerId: document.owner.id,
      filename: document.filename,
      fileType: document.fileType,
      fileSize: document.fileSize,
      description: document.description ?? undefined,
      uploadedAt: document.uploadedAt,
      ownerEmail: document.owner.email,
      ownerName: document.owner.name,
    };
  }

  async submitAccessRequest(
    documentId: string,
    submitDto: SubmitAccessRequestDto,
  ): Promise<AccessRequestSubmissionResponseDto> {
    const document = await this.documentRepository
      .createQueryBuilder('document')
      .where('document.id = :id', { id: documentId })
      .andWhere('document.visibilityStatus = :status', {
        status: VisibilityStatus.PUBLIC,
      })
      .andWhere('document.deletedAt IS NULL')
      .leftJoinAndSelect('document.owner', 'owner')
      .getOne();

    if (!document) {
      throw new NotFoundException('Document not found or is not publicly available');
    }

    const existingPendingRequest = await this.accessGrantRepository.findOne({
      where: {
        documentId,
        requestorEmail: submitDto.requestorEmail,
        status: AccessStatus.PENDING,
      },
    });

    if (existingPendingRequest) {
      throw new ConflictException(
        'You already have a pending request for this document. Please wait for the owner\'s response.',
      );
    }

    const requestUUID = uuidv4();
    const accessGrant = this.accessGrantRepository.create({
      documentId,
      document,
      requestorEmail: submitDto.requestorEmail,
      requestorName: submitDto.requestorName || submitDto.requestorEmail,
      requestorOrganization: submitDto.requestorOrganization,
      requestPurpose: submitDto.requestPurpose,
      status: AccessStatus.PENDING,
      accessToken: requestUUID,
    });

    const savedGrant = await this.accessGrantRepository.save(accessGrant);

    const requestorName = submitDto.requestorName || submitDto.requestorEmail;
    const requestorMessage = `Hello,\n\nYour access request for "${document.filename}" has been submitted successfully.\n\nRequest UUID: ${requestUUID}\n\nThe document owner will review your request and send a decision via email. You can also use your UUID to check your request status.\n\nThank you for your interest in this document.`;

    this.sendMockNotification(submitDto.requestorEmail, requestorMessage);

    const ownerMessage = `New access request for document "${document.filename}".\n\nRequestor Email: ${submitDto.requestorEmail}\n${submitDto.requestorName ? `Name: ${submitDto.requestorName}\n` : ''}${submitDto.requestorOrganization ? `Organization: ${submitDto.requestorOrganization}\n` : ''}Purpose: ${submitDto.requestPurpose}\n\nPlease review and respond to this request through your dashboard.`;

    this.sendMockNotification(document.owner.email, ownerMessage);

    const retrievalPageUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/request-status/${requestUUID}`;

    return {
      id: savedGrant.id,
      documentId,
      filename: document.filename,
      requestorEmail: submitDto.requestorEmail,
      requestUUID,
      status: AccessStatus.PENDING,
      message: 'Request submitted successfully. Check your email for confirmation.',
      retrievalPageUrl,
    };
  }

  async getRequestStatus(
    requestUUID: string,
  ): Promise<RequestStatusResponseDto> {
    const accessGrant = await this.accessGrantRepository
      .createQueryBuilder('ag')
      .where('ag.accessToken = :token', { token: requestUUID })
      .leftJoinAndSelect('ag.document', 'document')
      .leftJoinAndSelect('document.owner', 'owner')
      .getOne();

    if (!accessGrant) {
      throw new NotFoundException(
        'Request not found. Please verify your UUID and try again.',
      );
    }

    const response: RequestStatusResponseDto = {
      id: accessGrant.id,
      documentId: accessGrant.documentId,
      filename: accessGrant.document.filename,
      requestorEmail: accessGrant.requestorEmail,
      requestorName: accessGrant.requestorName ?? undefined,
      ownerEmail: accessGrant.document.owner.email,
      status: accessGrant.status,
      requestedAt: accessGrant.requestedAt,
      expiryDate: accessGrant.expiryDate ?? undefined,
      denialReason: accessGrant.denialReason ?? undefined,
      approvalMessage: accessGrant.approvalMessage ?? undefined,
      actionCompletedAt: accessGrant.actionCompletedAt ?? undefined,
    };

    if (accessGrant.status === AccessStatus.APPROVED && accessGrant.isActive()) {
      response.accessUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/access-token/${requestUUID}`;
    }

    return response;
  }

  private mapToPublicDocumentDto(
    document: DocumentFile,
  ): PublicDocumentResponseDto {
    return {
      id: document.id,
      filename: document.filename,
      fileType: document.fileType,
      fileSize: document.fileSize,
      description: document.description ?? undefined,
      uploadedAt: document.uploadedAt,
      ownerEmail: document.owner.email,
      ownerName: document.owner.name,
    };
  }

  private sendMockNotification(email: string, message: string): void {
    this.logger.log(
      `[MOCK NOTIFICATION] Message sent to ${email}: ${message.substring(0, 100)}...`,
    );
  }
}

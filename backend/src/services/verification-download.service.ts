import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AccessGrant, AccessStatus } from '../entities/access-grant.entity';
import { DownloadAuditLog, DownloadAction } from '../entities/download-audit-log.entity';
import { DocumentFile, VisibilityStatus } from '../entities/document-file.entity';
import {
  InitiateVerificationDto,
  VerificationInitiateResponseDto,
  RequestOtpDto,
  RequestOtpResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
  DownloadSessionCheckDto,
  SessionStatusDto,
  DownloadAuditListDto,
  DownloadAuditEntryDto,
} from '../dtos/verification-download.dto';

@Injectable()
export class VerificationDownloadService {
  private readonly logger = new Logger(VerificationDownloadService.name);
  private readonly OTP_VALIDITY_MINUTES = 15;
  private readonly OTP_MAX_ATTEMPTS = 3;
  private readonly SESSION_TIMEOUT_MINUTES = 60;

  constructor(
    @InjectRepository(AccessGrant)
    private accessGrantRepository: Repository<AccessGrant>,
    @InjectRepository(DownloadAuditLog)
    private auditLogRepository: Repository<DownloadAuditLog>,
    @InjectRepository(DocumentFile)
    private documentRepository: Repository<DocumentFile>,
  ) {}

  async initiateVerification(
    dto: InitiateVerificationDto,
  ): Promise<VerificationInitiateResponseDto> {
    const accessGrant = await this.findAccessGrantByTokenAndEmail(
      dto.requestUUID,
      dto.requestorEmail,
    );

    if (!accessGrant) {
      this.logger.warn(
        `Verification failed: Invalid UUID or email mismatch - ${dto.requestUUID}`,
      );
      throw new NotFoundException(
        'Request UUID not found or email does not match our records.',
      );
    }

    if (accessGrant.status !== AccessStatus.APPROVED) {
      const errorMessage = this.getStatusErrorMessage(accessGrant.status);
      throw new BadRequestException(errorMessage);
    }

    if (accessGrant.isExpired()) {
      throw new BadRequestException(
        `This access request has expired as of ${accessGrant.expiryDate?.toISOString().split('T')[0]}. You can no longer retrieve this document.`,
      );
    }

    // Check if document is still publicly accessible
    if (accessGrant.document.visibilityStatus !== VisibilityStatus.PUBLIC) {
      throw new ForbiddenException(
        'This document is no longer available for download. The owner has restricted access.',
      );
    }

    // Log verification initiation
    await this.createAuditLog(
      accessGrant,
      DownloadAction.SESSION_CREATED,
      'Verification session initiated',
    );

    return {
      success: true,
      message: 'Verification initiated. OTP will be sent to your email.',
      requestUUID: accessGrant.accessToken!,
      requestorEmail: accessGrant.requestorEmail,
      requestorName: accessGrant.requestorName ?? undefined,
      documentName: accessGrant.document?.filename || 'Document',
    };
  }

  async requestOtp(dto: RequestOtpDto): Promise<RequestOtpResponseDto> {
    const accessGrant = await this.findAccessGrantByTokenAndEmail(
      dto.requestUUID,
      dto.requestorEmail,
    );

    if (!accessGrant) {
      throw new NotFoundException(
        'Request UUID not found or email does not match our records.',
      );
    }

    if (!accessGrant.canRequestOtp()) {
      console.log(`OTP check = ${accessGrant.canRequestOtp()}`);
      throw new BadRequestException(
        'Cannot request OTP for this access grant.',
      );
    }

    // Check if document is still publicly accessible
    if (accessGrant.document.visibilityStatus !== VisibilityStatus.PUBLIC) {
      throw new ForbiddenException(
        'This document is no longer available for download. The owner has restricted access.',
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiryDate = new Date(
      Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000,
    );

    // If session is no longer active, reset verification state
    if (accessGrant.isVerified && !accessGrant.isSessionActive()) {
      accessGrant.isVerified = false;
      accessGrant.verifiedAt = null;
      accessGrant.downloadSessionToken = null;
      accessGrant.lastActivityAt = null;
      
      await this.createAuditLog(
        accessGrant,
        DownloadAction.SESSION_EXPIRED,
        'Previous session expired. Verification state reset for new OTP request.',
      );
    }

    // Reset OTP attempts and save
    accessGrant.otp = otp;
    accessGrant.otpExpiryDate = otpExpiryDate;
    accessGrant.otpAttempts = 0;

    await this.accessGrantRepository.save(accessGrant);

    // Send mock OTP email
    this.sendMockOtpEmail(
      accessGrant.requestorEmail,
      accessGrant.requestorName || accessGrant.requestorEmail,
      otp,
      accessGrant.document.filename,
    );

    // Log OTP request
    await this.createAuditLog(
      accessGrant,
      DownloadAction.OTP_REQUESTED,
      `OTP generated and sent to ${accessGrant.requestorEmail}`,
    );

    return {
      success: true,
      message: `OTP sent to ${accessGrant.requestorEmail}. Valid for ${this.OTP_VALIDITY_MINUTES} minutes.`,
      otpSentTo: accessGrant.requestorEmail,
      expiresIn: this.OTP_VALIDITY_MINUTES * 60,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const accessGrant = await this.findAccessGrantByTokenAndEmail(
      dto.requestUUID,
      dto.requestorEmail,
    );

    if (!accessGrant) {
      throw new NotFoundException(
        'Request UUID not found or email does not match our records.',
      );
    }

    if (!accessGrant.canVerifyOtp()) {
      if (accessGrant.otpAttempts >= this.OTP_MAX_ATTEMPTS) {
        await this.createAuditLog(
          accessGrant,
          DownloadAction.OTP_FAILED,
          'Maximum OTP attempts exceeded. Account locked for 15 minutes.',
        );
        throw new ConflictException(
          'Too many incorrect attempts. Please request a new OTP.',
        );
      }
      throw new BadRequestException('OTP is invalid or expired.');
    }

    if (accessGrant.otp !== dto.otp) {
      accessGrant.otpAttempts += 1;
      await this.accessGrantRepository.save(accessGrant);

      const remainingAttempts = this.OTP_MAX_ATTEMPTS - accessGrant.otpAttempts;
      await this.createAuditLog(
        accessGrant,
        DownloadAction.OTP_FAILED,
        `Invalid OTP attempt. ${remainingAttempts} attempts remaining.`,
      );

      throw new BadRequestException(
        `Invalid OTP. ${remainingAttempts} attempts remaining.`,
      );
    }

    // OTP verified successfully
    const downloadSessionToken = uuidv4();
    accessGrant.isVerified = true;
    accessGrant.verifiedAt = new Date();
    accessGrant.downloadSessionToken = downloadSessionToken;
    accessGrant.lastActivityAt = new Date();
    accessGrant.otp = '' as any; // Clear OTP for security (set to empty string)

    await this.accessGrantRepository.save(accessGrant);

    // Log successful verification
    await this.createAuditLog(
      accessGrant,
      DownloadAction.OTP_VERIFIED,
      'OTP verified successfully. Download session created.',
    );

    return {
      success: true,
      message: 'OTP verified successfully. You can now download your document.',
      downloadSessionToken,
      expiresIn: this.SESSION_TIMEOUT_MINUTES * 60,
    };
  }

  async validateDownloadSession(
    dto: DownloadSessionCheckDto,
  ): Promise<SessionStatusDto> {
    const accessGrant = await this.accessGrantRepository.findOne({
      where: {
        downloadSessionToken: dto.downloadSessionToken,
        isVerified: true,
      },
      relations: ['document'],
    });

    if (!accessGrant) {
      throw new NotFoundException('Invalid or expired download session.');
    }

    if (!accessGrant.isSessionActive()) {
      await this.createAuditLog(
        accessGrant,
        DownloadAction.SESSION_EXPIRED,
        'Download session expired due to inactivity or access expiry.',
      );
      throw new ForbiddenException(
        'Your session has expired for security reasons. Please verify again.',
      );
    }

    // Check if document is still publicly accessible
    if (accessGrant.document.visibilityStatus !== VisibilityStatus.PUBLIC) {
      await this.createAuditLog(
        accessGrant,
        DownloadAction.SESSION_EXPIRED,
        'Session validation failed: Document is no longer publicly accessible.',
      );
      throw new ForbiddenException(
        'This document is no longer available for download. The owner has restricted access.',
      );
    }

    // Update last activity
    accessGrant.lastActivityAt = new Date();
    await this.accessGrantRepository.save(accessGrant);

    return {
      isValid: true,
      expiresIn: this.SESSION_TIMEOUT_MINUTES * 60,
      requestorEmail: accessGrant.requestorEmail,
      documentName: accessGrant.document.filename,
    };
  }

  async getDocumentForDownload(
    downloadSessionToken: string,
  ): Promise<{ accessGrant: AccessGrant; document: DocumentFile }> {
    const accessGrant = await this.accessGrantRepository.findOne({
      where: {
        downloadSessionToken,
        isVerified: true,
      },
      relations: ['document'],
    });

    if (!accessGrant) {
      throw new NotFoundException('Invalid or expired download session.');
    }

    if (!accessGrant.isSessionActive()) {
      await this.createAuditLog(
        accessGrant,
        DownloadAction.SESSION_EXPIRED,
        'Download session expired during download attempt.',
      );
      throw new ForbiddenException(
        'Your session has expired for security reasons. Please verify again.',
      );
    }

    // Check if document is still publicly accessible
    if (accessGrant.document.visibilityStatus !== VisibilityStatus.PUBLIC) {
      await this.createAuditLog(
        accessGrant,
        DownloadAction.DOWNLOAD_FAILED,
        'Download blocked: Document is no longer publicly accessible.',
      );
      throw new ForbiddenException(
        'This document is no longer available for download. The owner has restricted access.',
      );
    }

    // Update last activity
    accessGrant.lastActivityAt = new Date();
    await this.accessGrantRepository.save(accessGrant);

    return { accessGrant, document: accessGrant.document };
  }

  async recordDownload(
    downloadSessionToken: string,
    bytesDownloaded: number,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const accessGrant = await this.accessGrantRepository.findOne({
      where: {
        downloadSessionToken,
        isVerified: true,
      },
    });

    if (!accessGrant) {
      throw new NotFoundException('Invalid download session.');
    }

    if (!accessGrant.isSessionActive()) {
      throw new ForbiddenException('Download session has expired.');
    }

    // Update last activity
    accessGrant.lastActivityAt = new Date();
    await this.accessGrantRepository.save(accessGrant);

    // Log download
    await this.createAuditLog(
      accessGrant,
      DownloadAction.DOWNLOAD_COMPLETED,
      `Document downloaded successfully. Size: ${bytesDownloaded} bytes.`,
      ipAddress,
      userAgent,
      bytesDownloaded,
    );

    this.logger.log(
      `[AUDIT] Download completed for ${accessGrant.requestorEmail} - Document: ${accessGrant.documentId} - Size: ${bytesDownloaded} bytes`,
    );
  }

  async getDownloadAuditTrail(
    documentId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<DownloadAuditListDto> {
    const skip = (page - 1) * limit;

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { documentId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        requestorEmail: log.requestorEmail,
        documentName: log.document?.filename || 'Unknown',
        details: log.details ?? undefined,
        timestamp: log.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async findAccessGrantByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<AccessGrant | null> {
    return this.accessGrantRepository.findOne({
      where: {
        accessToken: token,
        requestorEmail: email,
      },
      relations: ['document', 'document.owner'],
    });
  }

  private async createAuditLog(
    accessGrant: AccessGrant,
    action: DownloadAction,
    details: string,
    ipAddress?: string,
    userAgent?: string,
    bytesDownloaded?: number,
  ): Promise<void> {
    try {
      const auditLog = new DownloadAuditLog();
      auditLog.accessGrantId = accessGrant.id;
      auditLog.accessGrant = accessGrant;
      auditLog.documentId = accessGrant.documentId;
      auditLog.document = accessGrant.document;
      auditLog.requestorEmail = accessGrant.requestorEmail;
      auditLog.action = action;
      auditLog.details = details;
      auditLog.ipAddress = ipAddress || (null as any);
      auditLog.userAgent = userAgent || (null as any);
      auditLog.bytesDownloaded = bytesDownloaded || (null as any);

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      // Log but don't throw - audit logging should not fail the operation
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to create audit log: ${errorMessage}`, errorStack);
    }
  }

  private getStatusErrorMessage(status: AccessStatus): string {
    switch (status) {
      case AccessStatus.PENDING:
        return 'Your request is still pending review by the document owner. You will receive an email once a decision has been made.';
      case AccessStatus.DENIED:
        return 'Your access request has been denied by the document owner.';
      case AccessStatus.REVOKED:
        return 'Your access to this document has been revoked.';
      default:
        return 'You do not have permission to access this document.';
    }
  }

  private sendMockOtpEmail(
    email: string,
    name: string,
    otp: string,
    documentName: string,
  ): void {
    const message = `
Hello ${name},

Your One-Time Password (OTP) for document access is: ${otp}

This code is valid for 15 minutes. Please enter it in the verification form to access "${documentName}".

For security, do not share this code with anyone.

If you did not request this access, please ignore this email.
    `.trim();

    this.logger.log(
      `[MOCK NOTIFICATION] OTP Email sent to ${email}: ${message.substring(0, 100)}...`,
    );
  }
}

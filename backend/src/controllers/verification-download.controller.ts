import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ValidationPipe,
  Request,
  Response,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { VerificationDownloadService } from '../services/verification-download.service';
import { FileStorageService } from '../services/file-storage.service';
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
} from '../dtos/verification-download.dto';

@Controller('verification')
export class VerificationDownloadController {
  constructor(
    private readonly verificationDownloadService: VerificationDownloadService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiateVerification(
    @Body(ValidationPipe) dto: InitiateVerificationDto,
  ): Promise<VerificationInitiateResponseDto> {
    return this.verificationDownloadService.initiateVerification(dto);
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body(ValidationPipe) dto: RequestOtpDto,
  ): Promise<RequestOtpResponseDto> {
    return this.verificationDownloadService.requestOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(ValidationPipe) dto: VerifyOtpDto,
  ): Promise<VerifyOtpResponseDto> {
    return this.verificationDownloadService.verifyOtp(dto);
  }

  @Post('validate-session')
  @HttpCode(HttpStatus.OK)
  async validateSession(
    @Body(ValidationPipe) dto: DownloadSessionCheckDto,
  ): Promise<SessionStatusDto> {
    return this.verificationDownloadService.validateDownloadSession(dto);
  }
  
  @Get('download/:sessionToken')
  async downloadDocument(
    @Param('sessionToken') sessionToken: string,
    @Request() req: any,
    @Response() res: ExpressResponse,
  ): Promise<void> {
    const { document } = await this.verificationDownloadService.getDocumentForDownload(
      sessionToken,
    );

    if (!document || !document.storagePath) {
      res.status(HttpStatus.NOT_FOUND).json({
        message: 'Requested file not found for this verified session.',
      });
      return;
    }

    // Read file from storage
    let fileBuffer: Buffer;
    try {
      fileBuffer = await this.fileStorageService.readFile(document.storagePath);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'File not found in storage.' });
      return;
    }

    // Determine content type based on file type
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = contentTypeMap[document.fileType] || 'application/octet-stream';

    // Properly encode filename for Content-Disposition header (RFC 5987)
    const sanitizedFilename = document.filename.replace(/["\\\r\n]/g, '');
    const encodedFilename = encodeURIComponent(document.filename);

    // Set response headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(fileBuffer.length));

    // Get client information for audit log
    const ipAddress =
      req.ip ||
      req.headers?.['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      'unknown';
    const userAgent = req.get?.('user-agent') || 'unknown';

    // Send file
    res.send(fileBuffer);

    // Record download in audit log
    await this.verificationDownloadService.recordDownload(
      sessionToken,
      fileBuffer.length,
      String(ipAddress),
      userAgent,
    );
  }
  

  @Get('audit-trail/:documentId')
  @HttpCode(HttpStatus.OK)
  async getAuditTrail(
    @Param('documentId') documentId: string,
    @Param('page') page: number = 1,
  ): Promise<DownloadAuditListDto> {
    return this.verificationDownloadService.getDownloadAuditTrail(
      documentId,
      page,
      20,
    );
  }
}

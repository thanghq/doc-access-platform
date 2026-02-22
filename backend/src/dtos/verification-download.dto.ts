import {
  IsString,
  IsEmail,
  IsNumberString,
  Length,
  IsUUID,
  IsOptional,
} from 'class-validator';

// Verification DTOs
export class InitiateVerificationDto {
  @IsUUID()
  requestUUID: string;

  @IsEmail()
  requestorEmail: string;
}

export class VerificationInitiateResponseDto {
  success: boolean;
  message: string;
  requestUUID: string;
  requestorEmail: string;
  requestorName?: string;
  documentName: string;
}

// OTP DTOs
export class RequestOtpDto {
  @IsUUID()
  requestUUID: string;

  @IsEmail()
  requestorEmail: string;
}

export class RequestOtpResponseDto {
  success: boolean;
  message: string;
  otpSentTo: string;
  expiresIn: number;
}

export class VerifyOtpDto {
  @IsUUID()
  requestUUID: string;

  @IsEmail()
  requestorEmail: string;

  @IsNumberString()
  @Length(6, 6)
  otp: string;
}

export class VerifyOtpResponseDto {
  success: boolean;
  message: string;
  downloadSessionToken: string;
  expiresIn: number;
}

// Download DTOs
export class DownloadMetadataDto {
  documentId: string;
  filename: string;
  fileType: 'pdf' | 'xlsx' | 'docx';
  fileSize: number;
  lastUpdated: Date;
  expiryDate: Date;
  ownerEmail: string;
}

export class DownloadResponseDto {
  success: boolean;
  message: string;
  metadata: DownloadMetadataDto;
  downloadUrl: string;
  sessionExpiresIn: number;
}

export class DownloadSessionCheckDto {
  @IsUUID()
  downloadSessionToken: string;
}

export class SessionStatusDto {
  isValid: boolean;
  expiresIn: number;
  requestorEmail: string;
  documentName: string;
}

export class DocumentFileInfoDto {
  documentId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

// Audit Trail DTOs
export class DownloadAuditEntryDto {
  id: string;
  action: string;
  requestorEmail: string;
  documentName: string;
  details?: string;
  timestamp: Date;
}

export class DownloadAuditListDto {
  data: DownloadAuditEntryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Error Response DTOs
export class VerificationErrorDto {
  success: false;
  error: string;
  message: string;
  retryable: boolean;
  remainingAttempts?: number;
  lockoutUntil?: Date;
}

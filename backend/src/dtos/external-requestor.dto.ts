import {
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { PaginatedResponseDto } from './document.dto';

export class PublicDocumentResponseDto {
  id: string;
  filename: string;
  fileType: 'pdf' | 'xlsx' | 'docx';
  fileSize: number;
  description?: string;
  uploadedAt: Date;
  ownerEmail: string;
  ownerName: string;
}

export class PublicDocumentDetailDto extends PublicDocumentResponseDto {
  ownerId: string;
}

export class PublicDocumentsQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  fileTypes?: string | string[];

  @IsOptional()
  @IsString()
  sortBy?: 'uploadedAt' | 'filename' | 'fileSize';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}

export class SubmitAccessRequestDto {
  @IsEmail()
  requestorEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  requestorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  requestorOrganization?: string;

  @IsString()
  @MaxLength(500)
  requestPurpose: string;
}

export class AccessRequestSubmissionResponseDto {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestUUID: string;
  status: string;
  message: string;
  retrievalPageUrl: string;
}

export class RequestStatusResponseDto {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName?: string;
  ownerEmail: string;
  status: string;
  expiryDate?: Date;
  denialReason?: string;
  approvalMessage?: string;
  requestedAt: Date;
  actionCompletedAt?: Date;
  accessUrl?: string;
}

export enum PublicDocumentsSort {
  UPLOAD_DATE = 'uploadedAt',
  FILENAME = 'filename',
  FILE_SIZE = 'fileSize',
}

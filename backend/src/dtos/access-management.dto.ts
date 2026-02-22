import { IsString, IsEmail, IsOptional, MaxLength, IsDateString, IsDate } from 'class-validator';
import { AccessStatus } from '../entities/access-grant.entity';
import { Type } from 'class-transformer';

export class ApproveAccessRequestDto {
  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class DenyAccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RevokeAccessGrantDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class BulkRevokeAccessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class AccessRequestListDto {
  @IsOptional()
  @IsString()
  searchEmail?: string;

  @IsOptional()
  @IsString()
  filterFilename?: string;

  @IsOptional()
  @IsString()
  filterStatus?: AccessStatus;

  @Type(() => Number)
  page: number = 1;

  @Type(() => Number)
  limit: number = 10;
}

export class AccessRequestResponseDto {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName?: string;
  requestorOrganization?: string;
  requestPurpose: string;
  status: AccessStatus;
  expiryDate?: Date;
  denialReason?: string;
  approvalMessage?: string;
  requestedAt: Date;
  actionCompletedAt?: Date;
}

export class AccessGrantDetailDto {
  id: string;
  documentId: string;
  filename: string;
  requestorEmail: string;
  requestorName?: string;
  status: AccessStatus;
  expiryDate?: Date;
  requestedAt: Date;
  actionCompletedAt?: Date;
  isActive: boolean;
  isExpired: boolean;
}

export class ActiveAccessGrantsDto {
  active: AccessGrantDetailDto[];
  expired: AccessGrantDetailDto[];
  revoked: AccessGrantDetailDto[];
}

export enum AuditAction {
  REQUEST_APPROVED = 'REQUEST_APPROVED',
  REQUEST_DENIED = 'REQUEST_DENIED',
  REQUEST_REVOKED = 'REQUEST_REVOKED',
  REQUEST_BULK_REVOKED = 'REQUEST_BULK_REVOKED',
}

export class AuditTrailEntryDto {
  id: string;
  action: AuditAction;
  documentId: string;
  filename: string;
  requestorEmail: string;
  reason?: string;
  message?: string;
  timestamp: Date;
  details?: string;
}

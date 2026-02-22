import { IsString, IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { FileType, VisibilityStatus } from '../entities/document-file.entity';

export class CreateDocumentDto {
  @IsString()
  @MaxLength(255)
  filename: string;

  @IsEnum(FileType)
  fileType: FileType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateDocumentVisibilityDto {
  @IsEnum(VisibilityStatus)
  visibilityStatus: VisibilityStatus;
}

export class DocumentResponseDto {
  id: string;
  filename: string;
  fileType: FileType;
  fileSize: number;
  visibilityStatus: VisibilityStatus;
  description?: string;
  uploadedAt: Date;
  accessGrantsCount: number;
  activeAccessGrantsCount: number;
}

export class DocumentDetailDto extends DocumentResponseDto {
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
}

export class SearchDocumentsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum({ pdf: 'pdf', xlsx: 'xlsx', docx: 'docx' }, { each: true })
  fileTypes?: FileType[];

  @IsOptional()
  @IsString()
  sortBy?: 'uploadedAt' | 'filename' | 'fileSize';

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';

  page: number;
  limit: number;
}

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

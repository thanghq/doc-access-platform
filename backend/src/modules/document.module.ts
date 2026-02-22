import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentService } from '../services/document.service';
import { FileStorageService } from '../services/file-storage.service';
import { ExternalRequestorService } from '../services/external-requestor.service';
import { VerificationDownloadService } from '../services/verification-download.service';
import { DocumentController } from '../controllers/document.controller';
import { ExternalRequestorController } from '../controllers/external-requestor.controller';
import { VerificationDownloadController } from '../controllers/verification-download.controller';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentOwner } from '../entities/document-owner.entity';
import { AccessGrant } from '../entities/access-grant.entity';
import { DownloadAuditLog } from '../entities/download-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentFile,
      DocumentOwner,
      AccessGrant,
      DownloadAuditLog,
    ]),
  ],
  providers: [
    DocumentService,
    FileStorageService,
    ExternalRequestorService,
    VerificationDownloadService,
  ],
  controllers: [
    DocumentController,
    ExternalRequestorController,
    VerificationDownloadController,
  ],
  exports: [
    DocumentService,
    FileStorageService,
    ExternalRequestorService,
    VerificationDownloadService,
  ],
})
export class DocumentModule {}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { AccessGrant } from './access-grant.entity';
import { DocumentFile } from './document-file.entity';

export enum DownloadAction {
  DOWNLOAD_INITIATED = 'download_initiated',
  DOWNLOAD_COMPLETED = 'download_completed',
  DOWNLOAD_FAILED = 'download_failed',
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  OTP_REQUESTED = 'otp_requested',
  OTP_VERIFIED = 'otp_verified',
  OTP_FAILED = 'otp_failed',
  VERIFICATION_FAILED = 'verification_failed',
}

@Entity('download_audit_logs')
@Index(['accessGrantId', 'createdAt'])
@Index(['documentId', 'createdAt'])
@Index(['requestorEmail', 'createdAt'])
export class DownloadAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  accessGrantId: string;

  @ManyToOne(() => AccessGrant, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  accessGrant: AccessGrant;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  documentId: string;

  @ManyToOne(() => DocumentFile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  document: DocumentFile;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  requestorEmail: string;

  @Column({
    type: 'enum',
    enum: DownloadAction,
  })
  action: DownloadAction;

  @Column({
    type: 'text',
    nullable: true,
  })
  details: string | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ipAddress: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent: string | null;

  @Column({
    type: 'int',
    nullable: true,
  })
  bytesDownloaded: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

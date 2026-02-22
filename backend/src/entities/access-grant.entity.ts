import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { DocumentFile } from './document-file.entity';

export enum AccessStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  REVOKED = 'revoked',
}

@Entity('access_grants')
@Index(['documentId', 'requestorEmail'])
@Index(['documentId', 'status'])
export class AccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  documentId: string;

  @ManyToOne(() => DocumentFile, (document) => document.accessGrants, {
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
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  requestorName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  requestorOrganization: string | null;

  @Column({
    type: 'text',
    nullable: false,
  })
  requestPurpose: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  accessToken: string | null;

  @Column({
    type: 'enum',
    enum: AccessStatus,
    default: AccessStatus.PENDING,
  })
  status: AccessStatus;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  expiryDate: Date | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  denialReason: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  approvalMessage: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  revocationMessage: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  actionCompletedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  otp: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  otpExpiryDate: Date | null;

  @Column({
    type: 'int',
    default: 0,
  })
  otpAttempts: number;

  @Column({
    type: 'boolean',
    default: false,
  })
  isVerified: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  verifiedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  downloadSessionToken: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastActivityAt: Date | null;

  @CreateDateColumn()
  requestedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isActive(): boolean {
    if (this.status !== AccessStatus.APPROVED) {
      return false;
    }
    if (this.expiryDate && this.expiryDate < new Date()) {
      return false;
    }
    return true;
  }

  isExpired(): boolean {
    if (this.status !== AccessStatus.APPROVED) {
      return false;
    }
    if (this.expiryDate && this.expiryDate < new Date()) {
      return true;
    }
    return false;
  }

  isOtpExpired(): boolean {
    if (!this.otpExpiryDate) {
      return true;
    }
    return this.otpExpiryDate < new Date();
  }

  canRequestOtp(): boolean {
    if (this.status !== AccessStatus.APPROVED) {
      return false;
    }
    if (this.isExpired()) {
      return false;
    }
    return true;
  }

  canVerifyOtp(): boolean {
    // Can verify OTP if it's been generated and not expired
    if (!this.otp) {
      return false;
    }
    if (this.isOtpExpired()) {
      return false;
    }
    if (this.otpAttempts >= 3) {
      return false;
    }
    return true;
  }

  isSessionActive(): boolean {
    if (!this.isVerified) {
      return false;
    }
    if (this.isExpired()) {
      return false;
    }
    // Session expires after 60 minutes of inactivity
    if (this.lastActivityAt) {
      const inactiveMinutes = (Date.now() - this.lastActivityAt.getTime()) / (1000 * 60);
      return inactiveMinutes < 60;
    }
    return true;
  }
}

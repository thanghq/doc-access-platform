import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  Check,
} from 'typeorm';
import { DocumentOwner } from './document-owner.entity';
import { AccessGrant } from './access-grant.entity';

export enum FileType {
  PDF = 'pdf',
  XLSX = 'xlsx',
  DOCX = 'docx',
}

export enum VisibilityStatus {
  PUBLIC = 'public',
  HIDDEN = 'hidden',
}

@Entity('document_files')
@Index(['ownerId', 'uploadedAt'])
@Index(['visibilityStatus'])
@Check('"fileSize" > 0')
export class DocumentFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  filename: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  fileType: FileType;

  @Column({
    type: 'bigint',
    nullable: false,
  })
  fileSize: number;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  storagePath: string;

  @Column({
    type: 'enum',
    enum: VisibilityStatus,
    default: VisibilityStatus.HIDDEN,
  })
  visibilityStatus: VisibilityStatus;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  description: string | null;

  @ManyToOne(() => DocumentOwner, (owner) => owner.documents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  owner: DocumentOwner;

  @Column({
    nullable: false,
  })
  ownerId: string;

  @OneToMany(() => AccessGrant, (accessGrant) => accessGrant.document, {
    cascade: true,
  })
  accessGrants: AccessGrant[];

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  deletedAt: Date | null;

  isActive(): boolean {
    return this.deletedAt === null;
  }
}

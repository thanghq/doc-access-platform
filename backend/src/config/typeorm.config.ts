import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentOwner } from '../entities/document-owner.entity';
import { AccessGrant } from '../entities/access-grant.entity';
import { DownloadAuditLog } from '../entities/download-audit-log.entity';

export const typeormConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'doc_access_platform',
  entities: [DocumentFile, DocumentOwner, AccessGrant, DownloadAuditLog],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: true,
};

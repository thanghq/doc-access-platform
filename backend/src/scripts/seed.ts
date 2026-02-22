import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DocumentOwner } from '../entities/document-owner.entity';
import { typeormConfig } from '../config/typeorm.config';

const SEED_EMAIL = 'user1@email.com';
const SEED_PASSWORD = 'password1';
const SEED_NAME = 'Test Document Owner';
const SEED_ORGANIZATION = 'Test Organization';
const BCRYPT_ROUNDS = 10;

function logWithTimestamp(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️ ' : '✅';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function seed() {
  const environment = process.env.NODE_ENV || 'development';
  let dataSource: DataSource | null = null;
  
  logWithTimestamp(`Starting seed process in ${environment} environment`, 'info');
  
  if (environment === 'production') {
    logWithTimestamp('Seed data creation is not allowed in production environment', 'error');
    process.exit(1);
  }

  try {
    dataSource = new DataSource({
      ...typeormConfig,
      type: 'mysql',
    } as any);

    logWithTimestamp('Attempting to connect to database...', 'info');
    await dataSource.initialize();
    logWithTimestamp('Database connection established', 'info');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const documentOwnerRepo = queryRunner.manager.getRepository(DocumentOwner);

      logWithTimestamp(`Checking for existing user: ${SEED_EMAIL}`, 'info');
      const existingUser = await documentOwnerRepo.findOne({
        where: { email: SEED_EMAIL },
      });

      if (existingUser) {
        logWithTimestamp(`Seed user already exists: ${SEED_EMAIL}. Skipping creation.`, 'warn');
        await queryRunner.rollbackTransaction();
      } else {
        logWithTimestamp('Creating seed user with hashed password...', 'info');
        const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

        const user = documentOwnerRepo.create({
          email: SEED_EMAIL,
          passwordHash,
          name: SEED_NAME,
          organization: SEED_ORGANIZATION,
          isActive: true,
        });

        await documentOwnerRepo.save(user);
        await queryRunner.commitTransaction();
        
        logWithTimestamp(`Seed data created successfully: ${SEED_EMAIL}`, 'info');
        logWithTimestamp(`Role: Document Owner`, 'info');
        logWithTimestamp(`Credentials - Email: ${SEED_EMAIL}, Password: ${SEED_PASSWORD}`, 'info');
      }

      await queryRunner.release();
      await dataSource.destroy();
      logWithTimestamp('Seed process completed successfully', 'info');
      process.exit(0);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        logWithTimestamp('Failed to create seed data: Database connection error', 'error');
      } else {
        logWithTimestamp(`Failed to create seed data: ${error.message}`, 'error');
      }
    } else {
      logWithTimestamp('Failed to create seed data: Unknown error', 'error');
    }
    
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

seed();

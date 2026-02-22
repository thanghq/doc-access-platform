import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { FileType } from '../entities/document-file.entity';

const ALLOWED_FILE_TYPES = ['pdf', 'xlsx', 'docx'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const STORAGE_DIR = process.env.STORAGE_DIR || './storage/documents';

@Injectable()
export class FileStorageService {
  constructor() {
    this.ensureStorageDirectoryExists();
  }

  private async ensureStorageDirectoryExists() {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  async validateAndStoreFile(
    file: any,
    ownerId: string,
  ): Promise<{ storagePath: string; fileType: FileType; fileSize: number }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);

    if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
      throw new BadRequestException(
        `File type not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(', ').toUpperCase()}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024} MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    const fileId = uuid();
    const ownerDirectory = path.join(STORAGE_DIR, ownerId);
    await fs.mkdir(ownerDirectory, { recursive: true });

    const storagePath = path.join(ownerDirectory, fileId);
    await fs.writeFile(storagePath, file.buffer);

    return {
      storagePath,
      fileType: fileExtension as FileType,
      fileSize: file.size,
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
    } catch (error) {
      console.error(`Failed to delete file at ${storagePath}:`, error);
    }
  }

  async readFile(storagePath: string): Promise<Buffer> {
    return fs.readFile(storagePath);
  }

  getMaxFileSizeMB(): number {
    return MAX_FILE_SIZE / 1024 / 1024;
  }

  getAllowedFileTypes(): string[] {
    return ALLOWED_FILE_TYPES;
  }
}

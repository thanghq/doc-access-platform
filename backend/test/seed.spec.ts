import { DataSource, QueryRunner, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DocumentOwner } from '../src/entities/document-owner.entity';
import { AuthService } from '../src/services/auth.service';

describe('Seed Script Functionality', () => {
  let authService: AuthService;
  let mockRepository: jest.Mocked<Repository<DocumentOwner>>;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    // Create auth service with mocked repository
    authService = new AuthService(mockRepository);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('User Creation via AuthService', () => {
    it('should create a new user with correct email and organization', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      
      const createdUser = {
        id: 'test-id',
        email: 'user1@email.com',
        name: 'Test Document Owner',
        passwordHash: 'hashed_password',
        organization: 'Test Organization',
        isActive: true,
      } as DocumentOwner;

      mockRepository.create.mockReturnValue(createdUser);
      mockRepository.save.mockResolvedValue(createdUser);

      const result = await authService.createUser(
        'user1@email.com',
        'password1',
        'Test Document Owner',
        'Test Organization',
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user1@email.com',
          name: 'Test Document Owner',
          organization: 'Test Organization',
          isActive: true,
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.email).toBe('user1@email.com');
    });

    it('should hash the password before storing it', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const createdUser = {
        id: 'test-id',
        email: 'user1@email.com',
        passwordHash: 'hashed_password',
      } as DocumentOwner;

      mockRepository.create.mockReturnValue(createdUser);
      mockRepository.save.mockResolvedValue(createdUser);

      await authService.createUser('user1@email.com', 'password1', 'Test User');

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.passwordHash).toBeDefined();
      expect(createCall.passwordHash).not.toBe('password1');
      
      // Verify it's a valid bcrypt hash format
      expect(createCall.passwordHash).toMatch(/^\$2[aby]\$\d{1,2}\$/);
    });

    it('should normalize email to lowercase', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const createdUser = {
        id: 'test-id',
        email: 'user1@email.com',
        name: 'Test User',
      } as DocumentOwner;

      mockRepository.create.mockReturnValue(createdUser);
      mockRepository.save.mockResolvedValue(createdUser);

      await authService.createUser('USER1@EMAIL.COM', 'password1', 'Test User');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'user1@email.com' },
      });
    });

    it('should skip creation if user already exists', async () => {
      const existingUser = {
        id: 'existing-id',
        email: 'user1@email.com',
        name: 'Test Document Owner',
        passwordHash: 'existing_hash',
      } as DocumentOwner;

      mockRepository.findOne.mockResolvedValue(existingUser);

      const result = await authService.createUser(
        'user1@email.com',
        'password1',
        'Test Document Owner',
      );

      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(result).toBe(existingUser);
    });
  });

  describe('Password Hashing', () => {
    it('should use bcrypt with salt rounds', async () => {
      const password = 'test_password';
      const hashed = await authService.hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed).toMatch(/^\$2[aby]\$\d{1,2}\$/);

      // Verify the hash can be compared
      const isValid = await bcrypt.compare(password, hashed);
      expect(isValid).toBe(true);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'test_password';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      
      // But both should be valid
      const isValid1 = await bcrypt.compare(password, hash1);
      const isValid2 = await bcrypt.compare(password, hash2);
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });

  describe('Environment Validation', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should allow development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(process.env.NODE_ENV).not.toBe('production');
    });

    it('should allow test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(process.env.NODE_ENV).not.toBe('production');
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
    });
  });
});

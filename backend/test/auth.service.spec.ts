import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/services/auth.service';
import { DocumentOwner } from '../src/entities/document-owner.entity';

describe('AuthService', () => {
  let service: AuthService;
  let repository: Repository<DocumentOwner>;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(DocumentOwner),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repository = module.get<Repository<DocumentOwner>>(
      getRepositoryToken(DocumentOwner),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      const mockUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'wrongPassword');

      expect(result).toBeNull();
    });

    it('should normalize email to lowercase and trim whitespace', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      await service.validateUser('  TEST@EXAMPLE.COM  ', 'password123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('login', () => {
    it('should return user info when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        organization: 'Test Org',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        organization: 'Test Org',
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        isActive: false,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not disclose which field is incorrect', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('createUser', () => {
    it('should create a new user with hashed password', async () => {
      const mockUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'newuser@example.com',
        name: 'New User',
        passwordHash: 'hashedPassword123',
        organization: 'Test Org',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.createUser(
        'newuser@example.com',
        'password123',
        'New User',
        'Test Org',
      );

      expect(result.email).toBe('newuser@example.com');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return existing user if email already exists', async () => {
      const existingUser: Partial<DocumentOwner> = {
        id: '1',
        email: 'existing@example.com',
        name: 'Existing User',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.createUser(
        'existing@example.com',
        'password123',
        'New User',
      );

      expect(result).toEqual(existingUser);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'testPassword123';
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);
    });
  });
});

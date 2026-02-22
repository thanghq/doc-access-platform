import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DocumentOwner } from '../entities/document-owner.entity';
import { LoginDto, AuthResponseDto } from '../dtos/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(DocumentOwner)
    private readonly documentOwnerRepository: Repository<DocumentOwner>,
  ) {}

  async validateUser(email: string, password: string): Promise<DocumentOwner | null> {
    const normalizedEmail = email.trim().toLowerCase();
    
    const user = await this.documentOwnerRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;
    
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization ?? undefined,
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async createUser(email: string, password: string, name: string, organization?: string): Promise<DocumentOwner> {
    const normalizedEmail = email.trim().toLowerCase();
    
    const existingUser = await this.documentOwnerRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      this.logger.warn(`Seed user already exists: ${normalizedEmail}. Skipping creation.`);
      return existingUser;
    }

    const passwordHash = await this.hashPassword(password);

    const user = this.documentOwnerRepository.create({
      email: normalizedEmail,
      passwordHash,
      name,
      organization,
      isActive: true,
    });

    const savedUser = await this.documentOwnerRepository.save(user);
    this.logger.log(`User created successfully: ${normalizedEmail}`);
    
    return savedUser;
  }
}

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Session,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto, AuthResponseDto } from '../dtos/auth.dto';
import { AuthGuard } from '../guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Session() session: Record<string, any>,
  ): Promise<AuthResponseDto> {
    const user = await this.authService.login(loginDto);
    
    session.userId = user.id;
    session.email = user.email;
    session.isAuthenticated = true;

    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(@Session() session: Record<string, any>): Promise<{ message: string }> {
    return new Promise((resolve, reject) => {
      session.destroy((err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({ message: 'Logged out successfully' });
        }
      });
    });
  }

  @Get('session')
  @UseGuards(AuthGuard)
  async getSession(@Session() session: Record<string, any>): Promise<{ isAuthenticated: boolean; userId?: string; email?: string }> {
    return {
      isAuthenticated: session.isAuthenticated || false,
      userId: session.userId,
      email: session.email,
    };
  }
}

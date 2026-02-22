import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';
import { DocumentModule } from './modules/document.module';
import { AuthModule } from './modules/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeormConfig),
    DocumentModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

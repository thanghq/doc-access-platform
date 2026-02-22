import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExternalRequestorService } from '../services/external-requestor.service';
import { PaginatedResponseDto } from '../dtos/document.dto';
import {
  PublicDocumentResponseDto,
  PublicDocumentDetailDto,
  PublicDocumentsQueryDto,
  SubmitAccessRequestDto,
  AccessRequestSubmissionResponseDto,
  RequestStatusResponseDto,
} from '../dtos/external-requestor.dto';

@Controller('public')
export class ExternalRequestorController {
  constructor(
    private readonly externalRequestorService: ExternalRequestorService,
  ) {}

  @Get('documents')
  @HttpCode(HttpStatus.OK)
  async getPublicDocuments(
    @Query(ValidationPipe) query: PublicDocumentsQueryDto,
  ): Promise<PaginatedResponseDto<PublicDocumentResponseDto>> {
    return this.externalRequestorService.getPublicDocuments(query);
  }

  @Get('documents/:id')
  @HttpCode(HttpStatus.OK)
  async getPublicDocumentDetail(
    @Param('id') documentId: string,
  ): Promise<PublicDocumentDetailDto> {
    return this.externalRequestorService.getPublicDocumentDetail(documentId);
  }

  @Post('documents/:id/request-access')
  @HttpCode(HttpStatus.CREATED)
  async submitAccessRequest(
    @Param('id') documentId: string,
    @Body(ValidationPipe) submitDto: SubmitAccessRequestDto,
  ): Promise<AccessRequestSubmissionResponseDto> {
    return this.externalRequestorService.submitAccessRequest(
      documentId,
      submitDto,
    );
  }

  @Get('requests/:uuid/status')
  @HttpCode(HttpStatus.OK)
  async getRequestStatus(
    @Param('uuid') requestUUID: string,
  ): Promise<RequestStatusResponseDto> {
    return this.externalRequestorService.getRequestStatus(requestUUID);
  }
}

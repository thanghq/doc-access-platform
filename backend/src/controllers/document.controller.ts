import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from '../services/document.service';
import {
  CreateDocumentDto,
  UpdateDocumentVisibilityDto,
} from '../dtos/document.dto';
import {
  ApproveAccessRequestDto,
  DenyAccessRequestDto,
  RevokeAccessGrantDto,
  AccessRequestListDto,
  BulkRevokeAccessDto,
} from '../dtos/access-management.dto';
import { AuthGuard } from '../guards/auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  email: string;
}

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: any,
    @Body() createDocumentDto: CreateDocumentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.documentService.uploadDocument(
      currentUser.id,
      file,
      createDocumentDto,
    );
  }

  @Get()
  async getMyDocuments(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('query') query?: string,
    @Query('fileTypes') fileTypes?: string[],
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {

    const parsedFileTypes = fileTypes
      ? Array.isArray(fileTypes)
        ? fileTypes
        : [fileTypes]
      : undefined;

    return this.documentService.getMyDocuments(currentUser.id, {
      page: Math.max(1, page),
      limit: Math.min(limit, 100),
      query,
      fileTypes: parsedFileTypes as any,
      sortBy: (sortBy as any) || 'uploadedAt',
      sortOrder: sortOrder || 'DESC',
    });
  }

  @Get(':id')
  async getDocumentDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    return this.documentService.getDocumentDetail(id, currentUser.id);
  }

  @Put(':id/visibility')
  async updateDocumentVisibility(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateDocumentVisibilityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    return this.documentService.updateDocumentVisibility(
      id,
      currentUser.id,
      updateDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    await this.documentService.deleteDocument(id, currentUser.id);
  }

  @Get(':id/access-grants')
  async getDocumentAccessGrants(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    return this.documentService.getDocumentAccessGrants(
      id,
      currentUser.id,
      page,
      limit,
    );
  }

  @Delete(':id/access-grants/:grantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAccessGrant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('grantId', new ParseUUIDPipe()) grantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() revokeDto?: RevokeAccessGrantDto,
  ) {

    await this.documentService.revokeAccessGrant(
      id,
      grantId,
      currentUser.id,
      revokeDto,
    );
  }

  @Post(':id/access-grants/:grantId/approve')
  async approveAccessRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('grantId', new ParseUUIDPipe()) grantId: string,
    @Body() approveDto: ApproveAccessRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    return this.documentService.approveAccessRequest(
      id,
      grantId,
      currentUser.id,
      approveDto,
    );
  }

  @Post(':id/access-grants/:grantId/deny')
  async denyAccessRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('grantId', new ParseUUIDPipe()) grantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() denyDto?: DenyAccessRequestDto,
  ) {

    return this.documentService.denyAccessRequest(
      id,
      grantId,
      currentUser.id,
      denyDto,
    );
  }

  @Get('access-requests/pending')
  async listAccessRequests(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('searchEmail') searchEmail?: string,
    @Query('filterFilename') filterFilename?: string,
  ) {

    return this.documentService.listAccessRequests(currentUser.id, {
      page: Math.max(1, page),
      limit: Math.min(limit, 100),
      searchEmail,
      filterFilename,
    });
  }

  @Get('access-requests/history')
  async listAccessRequestHistory(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('searchEmail') searchEmail?: string,
    @Query('filterFilename') filterFilename?: string,
    @Query('filterStatus') filterStatus?: string,
  ) {

    return this.documentService.listAccessRequestHistory(currentUser.id, {
      page: Math.max(1, page),
      limit: Math.min(limit, 100),
      searchEmail,
      filterFilename,
      filterStatus: filterStatus as any,
    });
  }

  @Get('access-requests/audit-trail')
  async getAuditTrail(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    return this.documentService.getAuditTrail(
      currentUser.id,
      Math.max(1, page),
      Math.min(limit, 100),
    );
  }

  @Get(':id/access-grants-summary')
  async getAccessGrantsForFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {

    return this.documentService.getAccessGrantsForFile(id, currentUser.id);
  }

  @Post(':id/access-grants/bulk-revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkRevokeAccess(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() bulkRevokeDto?: BulkRevokeAccessDto,
  ) {

    await this.documentService.bulkRevokeAccess(
      id,
      currentUser.id,
      bulkRevokeDto,
    );
  }
}

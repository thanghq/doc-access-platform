import axiosInstance from '../config/axios.config';
import { AxiosInstance } from 'axios';

export interface DocumentResponse {
  id: string;
  filename: string;
  fileType: 'pdf' | 'xlsx' | 'docx';
  fileSize: number;
  visibilityStatus: 'public' | 'hidden';
  description?: string;
  uploadedAt: string;
  accessGrantsCount: number;
  activeAccessGrantsCount: number;
}

export interface DocumentDetail extends DocumentResponse {
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AccessGrant {
  id: string;
  documentId: string;
  requestorEmail: string;
  requestorName: string;
  requestorOrganization?: string;
  requestPurpose?: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  expiryDate?: string;
  denialReason?: string;
  requestedAt: string;
  updatedAt: string;
}

export interface SearchParams {
  page?: number;
  limit?: number;
  query?: string;
  fileTypes?: ('pdf' | 'xlsx' | 'docx')[];
  sortBy?: 'uploadedAt' | 'filename' | 'fileSize';
  sortOrder?: 'ASC' | 'DESC';
}

class DocumentService {
  private api: AxiosInstance;

  constructor() {
    this.api = axiosInstance;
  }

  async uploadDocument(
    file: File,
    filename: string,
    fileType: string,
    description?: string,
  ): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', filename);
    formData.append('fileType', fileType);
    if (description) {
      formData.append('description', description);
    }

    const { data } = await this.api.post<DocumentResponse>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  }

  async getMyDocuments(params: SearchParams): Promise<PaginatedResponse<DocumentResponse>> {
    const { data } = await this.api.get<PaginatedResponse<DocumentResponse>>(
      '/documents',
      { params },
    );
    return data;
  }

  async getDocumentDetail(id: string): Promise<DocumentDetail> {
    const { data } = await this.api.get<DocumentDetail>(`/documents/${id}`);
    return data;
  }

  async updateDocumentVisibility(
    id: string,
    visibilityStatus: 'public' | 'hidden',
  ): Promise<DocumentResponse> {
    const { data } = await this.api.put<DocumentResponse>(
      `/documents/${id}/visibility`,
      { visibilityStatus },
    );
    return data;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.api.delete(`/documents/${id}`);
  }

  async getDocumentAccessGrants(
    id: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<AccessGrant>> {
    const { data } = await this.api.get<PaginatedResponse<AccessGrant>>(
      `/documents/${id}/access-grants`,
      { params: { page, limit } },
    );
    return data;
  }

  async revokeAccessGrant(documentId: string, grantId: string): Promise<void> {
    await this.api.delete(`/documents/${documentId}/access-grants/${grantId}`);
  }

  async bulkRevokeAccess(
    documentId: string,
    revocationMessage?: string,
  ): Promise<void> {
    await this.api.post(`/documents/${documentId}/access-grants/bulk-revoke`, {
      revocationMessage,
    });
  }
}

export default new DocumentService();

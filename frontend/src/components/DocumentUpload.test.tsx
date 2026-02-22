import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DocumentUpload from './DocumentUpload';
import documentService from '../services/documentService';

jest.mock('../services/documentService', () => ({
  __esModule: true,
  default: {
    uploadDocument: jest.fn(),
  },
}));

describe('DocumentUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render upload form', () => {
    render(<DocumentUpload onUploadSuccess={mockOnUploadSuccess} />);
    expect(screen.getByRole('heading', { name: /Upload Document/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Select File/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Document Name/i)).toBeInTheDocument();
  });

  it('should reject non-allowed file types', async () => {
    render(<DocumentUpload onUploadSuccess={mockOnUploadSuccess} />);

    const fileInput = screen.getByLabelText(/Select File/i) as HTMLInputElement;
    const exeFile = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });

    fireEvent.change(fileInput, { target: { files: [exeFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/File type not supported.*Allowed types.*PDF.*XLSX.*DOCX/i),
      ).toBeInTheDocument();
    });
  });

  it('should reject files exceeding size limit', async () => {
    render(<DocumentUpload onUploadSuccess={mockOnUploadSuccess} />);

    const fileInput = screen.getByLabelText(/Select File/i) as HTMLInputElement;

    // Create a file larger than 100MB
    const largeFile = new File(['a'.repeat(101 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds maximum limit/i)).toBeInTheDocument();
    });
  });

  it('should successfully upload a valid PDF file', async () => {
    const mockUploadDocument = documentService.uploadDocument as jest.Mock;
    mockUploadDocument.mockResolvedValue({
      id: 'doc-123',
      filename: 'test.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      visibilityStatus: 'hidden',
      uploadedAt: new Date().toISOString(),
      accessGrantsCount: 0,
      activeAccessGrantsCount: 0,
    });

    jest.useFakeTimers();

    render(<DocumentUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Select File/i) as HTMLInputElement;
    const filenameInput = screen.getByLabelText(/Document Name/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Upload Document/i });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(filenameInput, { target: { value: 'My Document' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalledWith(
        expect.any(File),
        'My Document',
        'pdf',
        undefined,
      );
      expect(screen.getByText(/Document uploaded successfully/i)).toBeInTheDocument();
    });

    // Fast-forward time to trigger the onUploadSuccess callback
    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  it('should display error message on upload failure', async () => {
    const mockUploadDocument = documentService.uploadDocument as jest.Mock;
    mockUploadDocument.mockRejectedValue({
      response: { data: { message: 'Upload failed' } },
    });

    render(<DocumentUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Select File/i) as HTMLInputElement;
    const filenameInput = screen.getByLabelText(/Document Name/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Upload Document/i });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(filenameInput, { target: { value: 'Test' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });

    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
  });

  it('should require filename before submission', () => {
    render(<DocumentUpload onUploadSuccess={mockOnUploadSuccess} />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Select File/i) as HTMLInputElement;
    const filenameInput = screen.getByLabelText(/Document Name/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Upload Document/i }) as HTMLButtonElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    // After selecting file, filename is auto-filled from file name
    // Clear it to test the disabled state
    fireEvent.change(filenameInput, { target: { value: '' } });

    // Filename is empty, button should be disabled
    expect(submitButton.disabled).toBe(true);
  });
});

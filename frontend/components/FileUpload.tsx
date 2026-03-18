'use client';

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function FileUpload({ onUpload, isUploading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'Please upload a CSV file';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File exceeds 10MB limit';
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onUpload(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div className="mb-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/30 hover:border-primary/50'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept=".csv,.CSV"
          onChange={handleInputChange}
          className="hidden"
          id="csv-upload"
          disabled={isUploading}
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-muted rounded-full">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">
                  Drop a CSV file here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  Max file size: 10MB
                </p>
              </>
            )}
          </div>
        </label>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}

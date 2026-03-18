import { Router, Request, Response } from 'express';
import multer from 'multer';
import { UploadResponse, ErrorResponse } from '../types.js';
import { validateCsvFile, processCsv } from '../services/csvProcessor.js';
import { generateStarterQuestions } from '../services/gemini.js';

export const uploadRouter = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const validation = validateCsvFile(file.originalname, file.size);
    if (!validation.valid) {
      cb(new Error(validation.error));
    } else {
      cb(null, true);
    }
  }
});

uploadRouter.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: true,
        message: 'No file uploaded. Please select a CSV file.',
        retryable: false,
        fallbackUsed: false
      } as ErrorResponse);
      return;
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const filename = req.file.originalname;

    // Process CSV
    const result = await processCsv(fileContent, filename);

    if (!result.success || !result.healthCard) {
      res.status(400).json({
        error: true,
        message: result.error || 'Could not read this file. Please check it is a valid CSV.',
        retryable: false,
        fallbackUsed: false
      } as ErrorResponse);
      return;
    }

    // Generate AI-powered starter questions
    const columns = result.schema?.map(col => ({
      name: col.name,
      type: col.type
    })) || [];

    let starterQuestions: string[];
    try {
      starterQuestions = await generateStarterQuestions(result.tableName!, columns);
    } catch {
      // Fallback to default questions
      starterQuestions = [
        `How many records are in the ${filename} data?`,
        'Show me a summary of all columns',
        'What are the unique values in each column?',
        'Show me the first 10 rows',
        'What is the data distribution?'
      ];
    }

    const response: UploadResponse = {
      tableName: result.tableName!,
      schema: result.schema!,
      healthCard: result.healthCard,
      starterQuestions: starterQuestions.slice(0, 5)
    };

    res.json(response);
  } catch (error) {
    console.error('Upload error:', error);

    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: true,
          message: 'File exceeds 10MB limit.',
          retryable: false,
          fallbackUsed: false
        } as ErrorResponse);
        return;
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    res.status(500).json({
      error: true,
      message: errorMessage.includes('extension') || errorMessage.includes('limit')
        ? errorMessage
        : 'Could not read this file. Please check it is a valid CSV.',
      retryable: true,
      fallbackUsed: false
    } as ErrorResponse);
  }
});

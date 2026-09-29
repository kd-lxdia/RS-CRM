import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import { AuthenticatedRequest } from '../middlewares/auth';
import AWS from 'aws-sdk';
import axios from 'axios';
import { uploadBufferToS3 } from '../utils/s3';

const prisma = new PrismaClient();

// If S3 isn't properly configured or mocked for local dev, this handles that gracefully
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock',
  region: process.env.AWS_REGION || 'us-east-1'
});
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'mock-bucket';

export const downloadAllDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    const documents = await prisma.document.findMany({
      where: { customerId }
    });

    if (!documents || documents.length === 0) {
      return res.status(404).json({ success: false, error: 'No documents found for this customer' });
    }

    // Set headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=customer_${customerId}_documents.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    // Catch archiver warnings and errors
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', function (err) {
      throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Fetch and append each document
    for (const doc of documents) {
      try {
        // If it's a real S3 URL, we need to fetch it as a stream, or use S3 getObject
        // Since we might have mock URLs, let's treat it generically
        // If the URL is http..., we use axios to stream it
        if (doc.url.startsWith('http')) {
           const response = await axios({ method: 'GET', url: doc.url, responseType: 'stream' });
           // Append stream to archive
           // Use the document type and id as the filename in the zip
           const ext = doc.url.split('.').pop() || 'pdf';
           archive.append(response.data, { name: `${doc.type}_${doc.id}.${ext}` });
        } else {
           // Assume S3 key or local fallback
           // Let's create a dummy text file if it's just a mock string
           archive.append(doc.url, { name: `${doc.type}_${doc.id}.txt` });
        }
      } catch (e) {
        console.error(`Failed to fetch doc ${doc.id}: `, e);
      }
    }

    archive.finalize();

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const downloadDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            dealerId: true,
            assignedSalesperson: true,
            assignedDocumentation: true,
            assignedInstallation: true
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Security: Verify user has access to this document
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (userRole !== 'ADMIN' && userRole !== 'PROJECT_HEAD') {
      const hasAccess = 
        document.customer.dealerId === req.user?.dealerId ||
        document.customer.assignedSalesperson === userId ||
        document.customer.assignedDocumentation === userId ||
        document.customer.assignedInstallation === userId;
      
      if (!hasAccess) {
        return res.status(403).json({ 
          success: false, 
          error: 'You do not have permission to access this document' 
        });
      }
    }

    // Generate S3 Pre-signed URL (1 hour expiry)
    if (document.url.startsWith('http')) {
      return res.json({ success: true, url: document.url });
    }

    const params = {
      Bucket: bucketName,
      Key: document.url, 
      Expires: 3600 // 1 hour
    };
    
    const url = s3.getSignedUrl('getObject', params);

    res.json({ success: true, url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const uploadDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = (req.body.customerId || req.query.customerId) as string | undefined;
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customerId is required' });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Security: Require authenticated user
    const uploadedBy = req.user?.id;
    if (!uploadedBy) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const typeRaw = (req.body.type || 'OTHER') as string;
    const docType = (typeRaw.toUpperCase() || 'OTHER') as any;
    const timestamp = Date.now();

    const created = await Promise.all(
      files.map(async (file, idx) => {
        // Security: Sanitize filename to prevent path traversal
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `documents/${customerId}/${docType}/${timestamp}_${idx}_${sanitizedFilename}`;
        const url = await uploadBufferToS3(file.buffer, key, file.mimetype);
        return prisma.document.create({
          data: {
            customerId,
            leadId: req.body.leadId || null,
            type: docType,
            url,
            uploadedBy,
          },
        });
      })
    );

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

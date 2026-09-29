import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check validation results
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      }
    });
  }
  next();
};

/**
 * Payment validation rules
 */
export const validatePayment = [
  body('customerId').isUUID().withMessage('Invalid customer ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('mode').isIn(['CASH', 'CHEQUE', 'ONLINE', 'UPI', 'CARD']).withMessage('Invalid payment mode'),
  body('milestone').optional().isString().trim().isLength({ max: 100 }),
  body('transactionId').optional().isString().trim().isLength({ max: 100 }),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  validate
];

/**
 * Document upload validation rules
 */
export const validateDocumentUpload = [
  body('customerId').isUUID().withMessage('Invalid customer ID'),
  body('leadId').optional().isUUID().withMessage('Invalid lead ID'),
  body('type').optional().isIn(['AADHAAR', 'PAN', 'ELECTRICITY_BILL', 'PROPERTY_PAPERS', 'OTHER']),
  validate
];

/**
 * User creation validation rules
 */
export const validateUserCreation = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
  body('role').isIn(['ADMIN', 'PROJECT_HEAD', 'SALESPERSON', 'DOCUMENTATION', 'INSTALLATION', 'FINANCE']),
  body('dealerId').optional().isUUID().withMessage('Invalid dealer ID'),
  validate
];

/**
 * Proposal chatbot message validation
 */
export const validateChatbotMessage = [
  body('proposalId').isUUID().withMessage('Invalid proposal ID'),
  body('token').isString().trim().isLength({ min: 10, max: 100 }).withMessage('Invalid token'),
  body('message').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
  body('language').optional().isIn(['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'ml']),
  body('conversationHistory').optional().isArray({ max: 50 }).withMessage('Conversation history too long'),
  validate
];

/**
 * Date range validation
 */
export const validateDateRange = [
  query('dateFrom').optional().isISO8601().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().withMessage('Invalid dateTo format'),
  validate
];

/**
 * Pagination validation
 */
export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  validate
];

/**
 * UUID parameter validation
 */
export const validateUuidParam = (paramName: string = 'id') => [
  param(paramName).isUUID().withMessage(`Invalid ${paramName}`),
  validate
];

/**
 * Lead creation validation
 */
export const validateLeadCreation = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('phone').isMobilePhone('any').withMessage('Invalid phone number'),
  body('email').optional().isEmail().normalizeEmail(),
  body('address').optional().isString().trim().isLength({ max: 500 }),
  body('city').optional().isString().trim().isLength({ max: 100 }),
  body('state').optional().isString().trim().isLength({ max: 100 }),
  body('pincode').optional().isPostalCode('any'),
  body('monthlyBill').optional().isFloat({ min: 0 }),
  body('roofArea').optional().isFloat({ min: 0 }),
  validate
];

/**
 * Task creation validation
 */
export const validateTaskCreation = [
  body('title').isString().trim().isLength({ min: 3, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('assignedTo').isUUID().withMessage('Invalid assignedTo user ID'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  body('customerId').optional().isUUID(),
  body('leadId').optional().isUUID(),
  validate
];

/**
 * Campaign creation validation
 */
export const validateCampaignCreation = [
  body('name').isString().trim().isLength({ min: 3, max: 200 }),
  body('type').isIn(['WHATSAPP', 'EMAIL', 'SMS']),
  body('templateId').optional().isUUID(),
  body('scheduledAt').optional().isISO8601(),
  body('targetAudience').optional().isObject(),
  validate
];

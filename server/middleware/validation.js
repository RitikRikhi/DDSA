const { z } = require('zod');

// Authentication Schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required')
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional()
});

// User Schemas
const userCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().or(z.string()).optional(),
  departmentId: z.string().optional(),
  department: z.string().optional(),
  roleId: z.string().optional(),
  role: z.string().optional(),
  year: z.string().optional(),
  skills: z.array(z.string()).or(z.string()).optional(),
  attendancePercentage: z.number().min(0).max(100).optional()
});

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().or(z.string()).optional(),
  departmentId: z.string().optional(),
  department: z.string().optional(),
  roleId: z.string().optional(),
  role: z.string().optional(),
  year: z.string().optional(),
  skills: z.array(z.string()).or(z.string()).optional(),
  attendancePercentage: z.number().min(0).max(100).optional()
});

// Event Schemas
const eventCreateSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  banner: z.string().optional(),
  coverImage: z.string().optional(),
  venue: z.string().min(1, 'Venue is required'),
  description: z.string().optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  status: z.enum(['planning', 'live', 'completed']).optional().default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  tasksCount: z.number().int().min(0).optional(),
  completedTasks: z.number().int().min(0).optional(),
  assignedTeam: z.array(z.string()).optional()
}).refine(data => data.title || data.name, {
  message: 'Event title or name is required'
});

const eventUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  banner: z.string().optional(),
  coverImage: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  status: z.enum(['planning', 'live', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tasksCount: z.number().int().min(0).optional(),
  completedTasks: z.number().int().min(0).optional(),
  assignedTeam: z.array(z.string()).optional()
});

const eventAssignSchema = z.object({
  userId: z.string().min(1, 'User ID is required').optional(),
  userName: z.string().min(1, 'User name is required').optional(),
  responsibility: z.string().min(1, 'Responsibility is required').default('Crew Lead')
});

// Attendance Schemas
const attendanceCheckInSchema = z.object({
  userId: z.string().optional(),
  creator: z.string().min(1, 'Creator name is required').optional(),
  eventId: z.string().optional(),
  event: z.string().optional(),
  date: z.string().optional(),
  checkIn: z.string().optional(),
  status: z.string().optional().default('On Duty')
});

const attendanceCheckOutSchema = z.object({
  id: z.string().optional(),
  checkOut: z.string().optional(),
  totalHours: z.number().min(0).optional()
});

// Equipment Schemas
const equipmentCreateSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  serialNumber: z.string().min(1, 'Serial number is required').optional(),
  serialNo: z.string().min(1, 'Serial number is required').optional(),
  qrCode: z.string().optional(),
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Needs Maintenance']).optional().default('Excellent'),
  availability: z.enum(['Available', 'In Use', 'Maintenance']).optional().default('Available'),
  status: z.enum(['Available', 'In Use', 'Maintenance']).optional().default('Available'),
  image: z.string().optional()
}).refine(data => data.serialNumber || data.serialNo, {
  message: 'Serial number is required'
});

const equipmentBorrowSchema = z.object({
  borrower: z.string().min(1, 'Borrower name is required'),
  userId: z.string().optional(),
  returnDate: z.string().or(z.date()).optional(),
  expectedReturn: z.string().optional()
});

const equipmentReturnSchema = z.object({
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Needs Maintenance']).optional(),
  notes: z.string().optional()
});

// Media Schemas
const mediaFilterSchema = z.object({
  category: z.string().optional(),
  eventId: z.string().optional(),
  type: z.enum(['image', 'video']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['newest', 'oldest', 'name']).optional().default('newest')
});

// Notification Schemas
const notificationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['info', 'alert', 'success', 'event', 'equipment', 'media', 'attendance']).optional().default('info'),
  userId: z.string().optional()
});

// Middleware Generator
const validate = (schema) => (req, res, next) => {
  try {
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const result = schema.safeParse(dataToValidate);
    
    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: issues[0]?.message || 'Invalid request payload',
        details: issues.map(err => ({
          field: (err.path || []).join('.') || 'body',
          message: err.message
        }))
      });
    }

    if (req.method === 'GET') {
      req.validatedQuery = result.data;
    } else {
      req.body = result.data;
    }
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message
    });
  }
};

module.exports = {
  validate,
  loginSchema,
  registerSchema,
  userCreateSchema,
  userUpdateSchema,
  eventCreateSchema,
  eventUpdateSchema,
  eventAssignSchema,
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  equipmentCreateSchema,
  equipmentBorrowSchema,
  equipmentReturnSchema,
  mediaFilterSchema,
  notificationCreateSchema
};

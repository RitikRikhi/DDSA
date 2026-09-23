const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');
const { validate, eventCreateSchema, eventUpdateSchema, eventAssignSchema } = require('../middleware/validation');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Format event for consistent API response
 */
function formatEvent(e) {
  const assignedTeam = (e.assignments || []).map(a => a.user?.name || a.userId).filter(Boolean);
  return {
    id: e.id,
    title: e.title || e.name,
    name: e.name || e.title, // alias for backwards compatibility
    banner: e.banner || e.coverImage || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
    coverImage: e.coverImage || e.banner || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
    venue: e.venue,
    description: e.description || '',
    startDate: e.startDate,
    endDate: e.endDate,
    date: e.date || (e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : '2026-04-10'),
    time: e.time || '10:00 AM',
    status: e.status || 'planning',
    priority: e.priority || 'medium',
    tasksCount: e.tasksCount || 10,
    completedTasks: e.completedTasks || 0,
    assignedTeam: assignedTeam.length > 0 ? assignedTeam : (e.assignedTeam || []),
    assignments: e.assignments || [],
    createdAt: e.createdAt,
    updatedAt: e.updatedAt
  };
}

/**
 * GET /api/events
 * Retrieve list of events with filtering and search
 */
router.get('/', async (req, res) => {
  try {
    const { status, search, priority, page = 1, limit = 100 } = req.query;

    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { name: { contains: search } },
        { venue: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          assignments: {
            include: { user: true }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.event.count({ where })
    ]);

    const formatted = events.map(formatEvent);

    return res.status(200).json({
      success: true,
      data: formatted,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take)
    });
  } catch (err) {
    console.error('Fetch events error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * GET /api/events/:id
 * Retrieve event details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: { user: true }
        },
        mediaAssets: {
          take: 20,
          orderBy: { createdAt: 'desc' }
        },
        attendanceRecords: {
          take: 20,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Event not found'
      });
    }

    const formatted = formatEvent(event);
    formatted.media = event.mediaAssets;
    formatted.attendance = event.attendanceRecords;

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * POST /api/events
 * Create a new event
 */
router.post('/', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), validate(eventCreateSchema), async (req, res) => {
  try {
    const {
      title,
      name,
      banner,
      coverImage,
      venue,
      description,
      startDate,
      endDate,
      date,
      time,
      status = 'planning',
      priority = 'medium',
      tasksCount = 10,
      completedTasks = 0,
      assignedTeam = []
    } = req.body;

    const eventTitle = title || name;
    const bannerUrl = banner || coverImage || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800';

    const newEvent = await prisma.event.create({
      data: {
        title: eventTitle,
        name: eventTitle,
        banner: bannerUrl,
        coverImage: bannerUrl,
        venue,
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        date: date || (startDate ? new Date(startDate).toISOString().split('T')[0] : '2026-04-15'),
        time: time || '10:00 AM',
        status,
        priority,
        tasksCount,
        completedTasks,
        createdById: req.user.id
      }
    });

    // Handle initial team assignments
    if (Array.isArray(assignedTeam) && assignedTeam.length > 0) {
      for (const memberIdentifier of assignedTeam) {
        // Try finding user by name or ID
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { id: memberIdentifier },
              { name: memberIdentifier },
              { email: memberIdentifier }
            ]
          }
        });

        if (user) {
          await prisma.eventAssignment.create({
            data: {
              userId: user.id,
              eventId: newEvent.id,
              responsibility: 'Crew Member'
            }
          });
        }
      }
    }

    // Create system notification
    await createNotification({
      title: 'New Event Scheduled',
      message: `${eventTitle} has been scheduled at ${venue}`,
      type: 'event'
    });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_EVENT',
      entityType: 'Event',
      entityId: newEvent.id,
      details: `Created event: ${eventTitle} at ${venue}`
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id: newEvent.id },
      include: { assignments: { include: { user: true } } }
    });

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: formatEvent(fullEvent)
    });
  } catch (err) {
    console.error('Create event error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * PATCH /api/events/:id
 * Update event details or status
 */
router.patch('/:id', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), validate(eventUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      name,
      banner,
      coverImage,
      venue,
      description,
      startDate,
      endDate,
      date,
      time,
      status,
      priority,
      tasksCount,
      completedTasks,
      assignedTeam
    } = req.body;

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Event not found'
      });
    }

    const updateData = {};
    if (title || name) {
      updateData.title = title || name;
      updateData.name = title || name;
    }
    if (banner || coverImage) {
      updateData.banner = banner || coverImage;
      updateData.coverImage = banner || coverImage;
    }
    if (venue !== undefined) updateData.venue = venue;
    if (description !== undefined) updateData.description = description;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (date !== undefined) updateData.date = date;
    if (time !== undefined) updateData.time = time;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (tasksCount !== undefined) updateData.tasksCount = tasksCount;
    if (completedTasks !== undefined) updateData.completedTasks = completedTasks;

    // Update event
    const updated = await prisma.event.update({
      where: { id },
      data: updateData
    });

    // If assignedTeam is provided, synchronize assignments
    if (Array.isArray(assignedTeam)) {
      await prisma.eventAssignment.deleteMany({ where: { eventId: id } });
      for (const memberIdentifier of assignedTeam) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { id: memberIdentifier },
              { name: memberIdentifier },
              { email: memberIdentifier }
            ]
          }
        });
        if (user) {
          await prisma.eventAssignment.create({
            data: {
              userId: user.id,
              eventId: id,
              responsibility: 'Crew Member'
            }
          });
        }
      }
    }

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_EVENT',
      entityType: 'Event',
      entityId: id,
      details: `Updated event ${updated.title || updated.name}`
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id },
      include: { assignments: { include: { user: true } } }
    });

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: formatEvent(fullEvent)
    });
  } catch (err) {
    console.error('Update event error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * DELETE /api/events/:id
 * Delete an event
 */
router.delete('/:id', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Event not found'
      });
    }

    await prisma.event.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'DELETE_EVENT',
      entityType: 'Event',
      entityId: id,
      details: `Deleted event ${existing.title || existing.name}`
    });

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * POST /api/events/:id/assign
 * Assign a member to an event
 */
router.post('/:id/assign', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), validate(eventAssignSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, responsibility = 'Crew Lead' } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Event not found'
      });
    }

    let targetUserId = userId;
    if (!targetUserId && userName) {
      const u = await prisma.user.findFirst({ where: { name: userName } });
      if (u) targetUserId = u.id;
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User could not be identified'
      });
    }

    const assignment = await prisma.eventAssignment.upsert({
      where: {
        userId_eventId: {
          userId: targetUserId,
          eventId: id
        }
      },
      update: { responsibility },
      create: {
        userId: targetUserId,
        eventId: id,
        responsibility
      },
      include: { user: true, event: true }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'ASSIGN_CREW',
      entityType: 'EventAssignment',
      entityId: assignment.id,
      details: `Assigned ${assignment.user.name} to ${event.title || event.name} as ${responsibility}`
    });

    return res.status(201).json({
      success: true,
      message: 'Crew member assigned successfully',
      data: assignment
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * DELETE /api/events/assignments/:id or /api/events/:id/assignments/:assignmentId
 * Remove assignment
 */
router.delete(['/assignments/:id', '/:eventId/assignments/:id'], authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.eventAssignment.findUnique({
      where: { id },
      include: { user: true, event: true }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Assignment not found'
      });
    }

    await prisma.eventAssignment.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UNASSIGN_CREW',
      entityType: 'EventAssignment',
      entityId: id,
      details: `Removed assignment for ${assignment.user.name} from ${assignment.event.title || assignment.event.name}`
    });

    return res.status(200).json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

module.exports = router;

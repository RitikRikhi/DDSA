const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { optionalAuth, authenticate, requireRoles } = require('../middleware/authMiddleware');
const { validate, equipmentCreateSchema, equipmentBorrowSchema, equipmentReturnSchema } = require('../middleware/validation');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Format equipment object for API response
 */
function formatEquipment(g) {
  const activeBorrow = (g.borrowRecords || []).find(b => b.status === 'Active');
  return {
    id: g.id,
    name: g.name,
    category: g.category,
    serialNumber: g.serialNumber || g.serialNo,
    serialNo: g.serialNumber || g.serialNo, // backward compatibility
    qrCode: g.qrCode,
    condition: g.condition || 'Excellent',
    availability: g.status || g.availability || 'Available',
    status: g.status || g.availability || 'Available',
    image: g.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500',
    borrower: activeBorrow ? activeBorrow.borrower : null,
    returnDate: activeBorrow ? (activeBorrow.expectedReturn || (activeBorrow.returnDate ? new Date(activeBorrow.returnDate).toISOString().split('T')[0] : 'Soon')) : null,
    borrowRecords: g.borrowRecords || []
  };
}

/**
 * GET /api/equipment
 * List all equipment items with filtering
 */
router.get('/', async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 100 } = req.query;

    const where = {};
    if (category && category !== 'all') {
      where.category = { contains: category };
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { serialNumber: { contains: search } },
        { category: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [equipmentList, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          borrowRecords: {
            where: { status: 'Active' },
            take: 1
          }
        },
        skip,
        take,
        orderBy: { name: 'asc' }
      }),
      prisma.equipment.count({ where })
    ]);

    const formatted = equipmentList.map(formatEquipment);

    return res.status(200).json({
      success: true,
      data: formatted,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take)
    });
  } catch (err) {
    console.error('Fetch equipment error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * GET /api/equipment/:id
 * Retrieve single equipment details
 */
router.get('/:id', async (req, res) => {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
      include: {
        borrowRecords: {
          include: { user: true },
          orderBy: { issueDate: 'desc' }
        }
      }
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Equipment item not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: formatEquipment(equipment)
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
 * POST /api/equipment
 * Register new gear into inventory
 */
router.post('/', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), validate(equipmentCreateSchema), async (req, res) => {
  try {
    const { name, category, serialNumber, serialNo, qrCode, condition = 'Excellent', availability = 'Available', status = 'Available', image } = req.body;
    const serial = serialNumber || serialNo;

    const existing = await prisma.equipment.findUnique({
      where: { serialNumber: serial }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Conflict',
        message: 'An equipment item with this serial number already exists'
      });
    }

    const newEquipment = await prisma.equipment.create({
      data: {
        name,
        category,
        serialNumber: serial,
        serialNo: serial,
        qrCode: qrCode || null,
        condition,
        availability: status || availability,
        status: status || availability,
        image: image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500'
      }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'ADD_EQUIPMENT',
      entityType: 'Equipment',
      entityId: newEquipment.id,
      details: `Added ${newEquipment.name} (${newEquipment.category}) to inventory`
    });

    return res.status(201).json({
      success: true,
      message: 'Equipment registered successfully',
      data: formatEquipment(newEquipment)
    });
  } catch (err) {
    console.error('Create equipment error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * PATCH /api/equipment/:id
 * Update gear condition or details
 */
router.patch('/:id', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, serialNumber, serialNo, condition, availability, status, image } = req.body;

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Equipment item not found'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (serialNumber || serialNo) {
      updateData.serialNumber = serialNumber || serialNo;
      updateData.serialNo = serialNumber || serialNo;
    }
    if (condition) updateData.condition = condition;
    if (status || availability) {
      updateData.status = status || availability;
      updateData.availability = status || availability;
    }
    if (image !== undefined) updateData.image = image;

    const updated = await prisma.equipment.update({
      where: { id },
      data: updateData,
      include: {
        borrowRecords: {
          where: { status: 'Active' },
          take: 1
        }
      }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_EQUIPMENT',
      entityType: 'Equipment',
      entityId: id,
      details: `Updated gear details for ${updated.name}`
    });

    return res.status(200).json({
      success: true,
      message: 'Equipment updated successfully',
      data: formatEquipment(updated)
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
 * DELETE /api/equipment/:id
 * Remove equipment
 */
router.delete('/:id', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Equipment item not found'
      });
    }

    await prisma.equipment.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'DELETE_EQUIPMENT',
      entityType: 'Equipment',
      entityId: id,
      details: `Deleted gear ${existing.name}`
    });

    return res.status(200).json({
      success: true,
      message: `Equipment ${existing.name} deleted successfully`
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
 * POST /api/equipment/:id/borrow
 * Check-out equipment to a crew member
 */
router.post('/:id/borrow', optionalAuth, validate(equipmentBorrowSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { borrower, userId, returnDate, expectedReturn } = req.body;

    const equipment = await prisma.equipment.findUnique({ where: { id } });
    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Equipment not found'
      });
    }

    if (equipment.status === 'In Use') {
      return res.status(400).json({
        success: false,
        error: 'Conflict',
        message: `${equipment.name} is already checked out to another member.`
      });
    }

    const borrowerName = borrower || req.user?.name || 'Creator';
    const targetUserId = userId || req.user?.id || null;
    const expected = expectedReturn || returnDate || 'Tomorrow';

    // 1. Update Equipment status
    const updatedEquip = await prisma.equipment.update({
      where: { id },
      data: {
        status: 'In Use',
        availability: 'In Use'
      }
    });

    // 2. Create Borrow Record
    const record = await prisma.borrowRecord.create({
      data: {
        equipmentId: id,
        userId: targetUserId,
        borrower: borrowerName,
        issueDate: new Date(),
        returnDate: returnDate ? new Date(returnDate) : null,
        expectedReturn: expected,
        status: 'Active'
      }
    });

    // 3. Notify & Log
    await createNotification({
      title: 'Equipment Checked Out',
      message: `${equipment.name} has been checked out to ${borrowerName}`,
      type: 'equipment'
    });

    await logActivity({
      userId: targetUserId,
      userName: borrowerName,
      action: 'BORROW_EQUIPMENT',
      entityType: 'Equipment',
      entityId: id,
      details: `${borrowerName} checked out ${equipment.name}`
    });

    return res.status(200).json({
      success: true,
      message: `${equipment.name} checked out to ${borrowerName}`,
      data: {
        ...formatEquipment(updatedEquip),
        borrower: borrowerName,
        returnDate: expected
      }
    });
  } catch (err) {
    console.error('Borrow error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * POST /api/equipment/:id/return
 * Check-in equipment and mark returned
 */
router.post('/:id/return', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { condition = 'Excellent' } = req.body;

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        borrowRecords: {
          where: { status: 'Active' },
          take: 1
        }
      }
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Equipment not found'
      });
    }

    const activeBorrow = equipment.borrowRecords[0];

    // 1. Update equipment to Available
    const updatedEquip = await prisma.equipment.update({
      where: { id },
      data: {
        status: 'Available',
        availability: 'Available',
        condition
      }
    });

    // 2. Close active borrow record
    if (activeBorrow) {
      await prisma.borrowRecord.update({
        where: { id: activeBorrow.id },
        data: {
          status: 'Returned',
          actualReturnDate: new Date()
        }
      });
    }

    // 3. Notification & Log
    await createNotification({
      title: 'Equipment Returned',
      message: `${equipment.name} has been returned to inventory in ${condition} condition`,
      type: 'equipment'
    });

    await logActivity({
      userId: req.user?.id || null,
      userName: req.user?.name || activeBorrow?.borrower || 'System',
      action: 'RETURN_EQUIPMENT',
      entityType: 'Equipment',
      entityId: id,
      details: `${equipment.name} checked in successfully`
    });

    return res.status(200).json({
      success: true,
      message: `${equipment.name} checked in successfully`,
      data: formatEquipment(updatedEquip)
    });
  } catch (err) {
    console.error('Return error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

module.exports = router;

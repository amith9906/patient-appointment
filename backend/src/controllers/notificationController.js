const { Op } = require('sequelize');
const { Notification } = require('../models');
const notificationService = require('../utils/notificationService');

exports.listNotifications = async (req, res) => {
  try {
    const orClauses = [{ userId: req.user.id }];
    if (req.user.hospitalId) {
      orClauses.push({ hospitalId: req.user.hospitalId, userId: null });
    }
    const notifications = await Notification.findAll({
      where: { [Op.or]: orClauses },
      order: [['createdAt', 'DESC']],
      limit: 30,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const note = await Notification.findByPk(req.params.id);
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    if (note.userId && note.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    note.isRead = true;
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.refreshExpiryNotifications = async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can run expiry notifications' });
    }
    const meds = await notificationService.notifyExpiringMedications();
    res.json({ count: meds.length, medications: meds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

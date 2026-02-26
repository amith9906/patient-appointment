const { Op } = require('sequelize');
const { Notification, User, Nurse, Medication } = require('../models');
const { sendEmailNotification } = require('./mailer');

const ADMIN_ROLES = ['admin', 'super_admin'];

const formatDate = (value) => {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString();
};

const createNotification = async ({
  userId = null,
  hospitalId = null,
  title,
  message,
  type = 'general',
  metadata = null,
  link = null,
  emailTo = [],
  emailHtml = null,
  emailText = null,
}) => {
  const notification = await Notification.create({
    userId,
    hospitalId,
    type,
    title,
    message,
    metadata,
    link,
  });

  if (emailTo && emailTo.length) {
    await sendEmailNotification({
      to: emailTo,
      subject: title,
      html: emailHtml || `<p>${message}</p>`,
      text: emailText || message,
    });
  }

  return notification;
};

const findHospitalAdmins = async (hospitalId) => {
  const where = {
    role: { [Op.in]: ADMIN_ROLES },
  };
  if (hospitalId) where.hospitalId = hospitalId;
  return User.findAll({ where, attributes: ['id', 'email', 'name', 'hospitalId'] });
};

const notifyLeaveApplication = async (leave, nurse) => {
  const nurseWithUser = nurse || await Nurse.findByPk(leave.nurseId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }],
  });
  const nurseName = nurseWithUser?.name || 'Nurse';
  const hospitalId = nurseWithUser?.hospitalId || null;
  const summary = leave.isFullDay
    ? 'full-day'
    : `partial-day (${leave.startTime || 'N/A'} - ${leave.endTime || 'N/A'})`;
  const title = 'Nurse leave request submitted';
  const message = `${nurseName} requested ${summary} leave on ${formatDate(leave.leaveDate)}.`;
  const html = `
    <p>${message}</p>
    <p>Reason: ${leave.reason || 'Not provided'}</p>
  `;
  const admins = await findHospitalAdmins(hospitalId);
  await Promise.all(admins.map((admin) => createNotification({
    userId: admin.id,
    hospitalId: admin.hospitalId,
    title,
    message,
    type: 'leave',
    metadata: { nurseLeaveId: leave.id, nurseId: leave.nurseId },
    emailTo: admin.email ? [admin.email] : [],
    emailHtml: html,
  })));

  if (nurseWithUser?.user?.email) {
    await createNotification({
      userId: nurseWithUser.user.id,
      hospitalId,
      title: 'Leave request submitted',
      message: `Your leave request for ${formatDate(leave.leaveDate)} is pending approval.`,
      type: 'leave',
      metadata: { nurseLeaveId: leave.id },
      emailTo: [nurseWithUser.user.email],
      emailHtml: html,
    });
  }
};

const notifyLeaveDecision = async (leave, status) => {
  const nurseWithUser = await Nurse.findByPk(leave.nurseId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }],
  });
  const nurseName = nurseWithUser?.name || 'Nurse';
  const title = `Leave ${status}`;
  const message = `Your leave for ${formatDate(leave.leaveDate)} was ${status}.`;
  const processedBy = leave.approvedBy?.name || 'the administration staff';
  const html = `
    <p>${nurseName}, your leave request for ${formatDate(leave.leaveDate)} was <strong>${status}</strong>.</p>
    <p>Processed by ${processedBy}.</p>
  `;
  if (nurseWithUser?.user?.email) {
    await createNotification({
      userId: nurseWithUser.user.id,
      hospitalId: nurseWithUser.hospitalId,
      title,
      message,
      type: 'leave',
      metadata: { nurseLeaveId: leave.id },
      emailTo: [nurseWithUser.user.email],
      emailHtml: html,
    });
  }
};

const notifyExpiringMedications = async ({ windowDays = 30 } = {}) => {
  const today = new Date();
  const threshold = new Date(today.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const from = today.toISOString().split('T')[0];
  const to = threshold.toISOString().split('T')[0];
  const upcoming = await Medication.findAll({
    where: {
      isActive: true,
      expiryDate: { [Op.and]: [{ [Op.gte]: from }, { [Op.lte]: to }] },
    },
    order: [['expiryDate', 'ASC']],
    attributes: ['id', 'name', 'expiryDate'],
  });
  if (!upcoming.length) return [];
  const admins = await User.findAll({
    where: { role: { [Op.in]: ADMIN_ROLES } },
    attributes: ['id', 'email', 'hospitalId', 'name'],
  });
  const listText = upcoming.map((m) => `${m.name} (${formatDate(m.expiryDate)})`).join(', ');
  const title = 'Medicine expiry alert';
  const message = `The following medicines expire in the next ${windowDays} days: ${listText}.`;
  const html = `
    <p>Stock alerts:</p>
    <ul>${upcoming.map((m) => `<li>${m.name} — expires on ${formatDate(m.expiryDate)}</li>`).join('')}</ul>
    <p>Please clear or replace these items with upcoming restock.</p>
  `;
  await Promise.all(admins.map((admin) => createNotification({
    userId: admin.id,
    hospitalId: admin.hospitalId,
    title,
    message,
    type: 'medicine_expiry',
    metadata: { medicationIds: upcoming.map((m) => m.id), windowDays },
    emailTo: admin.email ? [admin.email] : [],
    emailHtml: html,
  })));
  return upcoming;
};

module.exports = {
  createNotification,
  notifyLeaveApplication,
  notifyLeaveDecision,
  notifyExpiringMedications,
};

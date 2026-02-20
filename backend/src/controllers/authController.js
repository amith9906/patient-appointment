const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Patient, Doctor, PasswordOtp } = require('../models');
const { sendPasswordOtpEmail } = require('../utils/mailer');

const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, dateOfBirth, gender } = req.body;
    const requestedRole = role || 'patient';
    if (requestedRole !== 'patient') {
      return res.status(403).json({ message: 'Only patient self-registration is allowed' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, role: requestedRole });

    // Auto-create Patient profile when registering as patient
    if (requestedRole === 'patient') {
      await Patient.create({ name, email, phone: phone || null, dateOfBirth: dateOfBirth || null, gender: gender || null, userId: user.id });
    }

    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospitalId } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospitalId } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'No active account found for this email' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PasswordOtp.update(
      { isUsed: true },
      { where: { userId: user.id, isUsed: false, expiresAt: { [Op.gt]: new Date() } } }
    );

    await PasswordOtp.create({
      userId: user.id,
      email: user.email,
      otpHash,
      expiresAt,
      isUsed: false,
    });

    const mailResult = await sendPasswordOtpEmail(user.email, otp, user.name);

    res.json({
      message: mailResult.delivered
        ? 'OTP sent to your email'
        : 'OTP generated. SMTP not configured, check server logs in development mode.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'No active account found for this email' });
    }

    const otpRecord = await PasswordOtp.findOne({
      where: {
        userId: user.id,
        email: user.email,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP is invalid or expired' });
    }

    const incomingHash = hashOtp(otp);
    if (incomingHash !== otpRecord.otpHash) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.password = newPassword;
    await user.save();
    otpRecord.isUsed = true;
    await otpRecord.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await user.validatePassword(currentPassword);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

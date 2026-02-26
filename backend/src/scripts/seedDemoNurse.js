require('dotenv').config();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sequelize, User, Hospital, Nurse } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // create or find hospital
    let hospital = await Hospital.findOne({ where: { name: 'Demo Hospital' } });
    if (!hospital) hospital = await Hospital.create({ name: 'Demo Hospital' });

    // demo nurse user
    const demoEmail = process.env.DEMO_NURSE_EMAIL || 'demo.nurse@example.com';
    const demoPass = process.env.DEMO_NURSE_PASSWORD || 'password123';
    let user = await User.findOne({ where: { email: demoEmail } });
    if (!user) {
      user = await User.create({ name: 'Demo Nurse', email: demoEmail, password: demoPass, role: 'nurse', hospitalId: hospital.id });
      console.log('Created demo user:', demoEmail);
    } else {
      console.log('Found existing user:', demoEmail);
    }

    // create nurse profile if not exists
    let nurse = await Nurse.findOne({ where: { userId: user.id } });
    if (!nurse) {
      nurse = await Nurse.create({ name: 'Demo Nurse', email: demoEmail, userId: user.id, hospitalId: hospital.id });
      console.log('Created Nurse profile for user');
    } else {
      console.log('Nurse profile already exists');
    }

    // generate token
    const secret = process.env.JWT_SECRET || 'testsecret';
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: '7d' });

    console.log('\nDemo nurse credentials:');
    console.log('  email:', demoEmail);
    console.log('  password:', demoPass);
    console.log('  userId:', user.id);
    console.log('  nurseId:', nurse.id);
    console.log('\nUse this JWT for API calls (Authorization: Bearer <token>):\n');
    console.log(token);
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();

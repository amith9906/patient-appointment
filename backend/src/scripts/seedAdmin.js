require('dotenv').config();
const { sequelize, User } = require('../models');

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || 'System Admin';
  const email = process.env.ADMIN_EMAIL || 'admin@local.test';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const existing = await User.findOne({ where: { email } });

    if (!existing) {
      const user = await User.create({
        name,
        email,
        password,
        role: 'super_admin',
        isActive: true,
      });

      console.log(`Admin created: ${user.email}`);
      return;
    }

    existing.name = name;
    existing.role = 'super_admin';
    existing.isActive = true;
    existing.password = password;
    await existing.save();

    console.log(`Admin updated: ${existing.email}`);
  } catch (error) {
    console.error('Failed to seed admin user:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seedAdmin();

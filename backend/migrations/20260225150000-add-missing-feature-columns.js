'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfoDepartments = await queryInterface.describeTable('Departments');
    if (!tableInfoDepartments.hodUserId) {
      await queryInterface.addColumn('Departments', 'hodUserId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      });
    }

    const tableInfoDoctorLeaves = await queryInterface.describeTable('DoctorLeaves');
    if (!tableInfoDoctorLeaves.status) {
      await queryInterface.addColumn('DoctorLeaves', 'status', {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
      });
    }
    if (!tableInfoDoctorLeaves.approvedByUserId) {
      await queryInterface.addColumn('DoctorLeaves', 'approvedByUserId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      });
    }
    if (!tableInfoDoctorLeaves.approvalDate) {
      await queryInterface.addColumn('DoctorLeaves', 'approvalDate', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const tableInfoOTSchedules = await queryInterface.describeTable('OTSchedules');
    if (!tableInfoOTSchedules.surgeryType) {
      await queryInterface.addColumn('OTSchedules', 'surgeryType', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // IPDBillItems -> itemType Enum update
    try {
      await queryInterface.sequelize.query('ALTER TYPE "enum_IPDBillItems_itemType" ADD VALUE \'medicine\'');
    } catch (e) {
      console.log('medicine value might already exist or error:', e.message);
    }
    try {
      await queryInterface.sequelize.query('ALTER TYPE "enum_IPDBillItems_itemType" ADD VALUE \'patient_expense\'');
    } catch (e) {
      console.log('patient_expense value might already exist or error:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Departments', 'hodUserId').catch(() => {});
    await queryInterface.removeColumn('DoctorLeaves', 'status').catch(() => {});
    await queryInterface.removeColumn('DoctorLeaves', 'approvedByUserId').catch(() => {});
    await queryInterface.removeColumn('DoctorLeaves', 'approvalDate').catch(() => {});
    await queryInterface.removeColumn('OTSchedules', 'surgeryType').catch(() => {});
  }
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // 1. Update User Role Enum
    try {
      await queryInterface.sequelize.query('ALTER TYPE "enum_Users_role" ADD VALUE \'nurse\'');
    } catch (e) {
      console.log('nurse role might already exist or error:', e.message);
    }

    // 2. Nurses Table
    if (!tables.includes('Nurses')) {
      await queryInterface.createTable('Nurses', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        phone: { type: Sequelize.STRING },
        email: { type: Sequelize.STRING, unique: true },
        specialization: { type: Sequelize.STRING },
        departmentId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Departments', key: 'id' }, onDelete: 'SET NULL',
        },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' }, onDelete: 'CASCADE',
        },
        userId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL',
        },
        isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // 3. Shifts Table
    if (!tables.includes('Shifts')) {
      await queryInterface.createTable('Shifts', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        startTime: { type: Sequelize.TIME, allowNull: false },
        endTime: { type: Sequelize.TIME, allowNull: false },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' }, onDelete: 'CASCADE',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // 4. NurseShiftAssignments Table
    if (!tables.includes('NurseShiftAssignments')) {
      await queryInterface.createTable('NurseShiftAssignments', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        nurseId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Nurses', key: 'id' }, onDelete: 'CASCADE',
        },
        shiftId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Shifts', key: 'id' }, onDelete: 'CASCADE',
        },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        workArea: {
          type: Sequelize.ENUM('IPD', 'OPD', 'Emergency', 'Other'),
          defaultValue: 'IPD',
        },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // 5. NursePatientAssignments Table
    if (!tables.includes('NursePatientAssignments')) {
      await queryInterface.createTable('NursePatientAssignments', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        nurseId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Nurses', key: 'id' }, onDelete: 'CASCADE',
        },
        admissionId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'IPDAdmissions', key: 'id' }, onDelete: 'CASCADE',
        },
        shiftId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Shifts', key: 'id' }, onDelete: 'SET NULL',
        },
        doctorId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Doctors', key: 'id' }, onDelete: 'SET NULL',
        },
        assignedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        removedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // 6. NurseLeaves Table
    if (!tables.includes('NurseLeaves')) {
      await queryInterface.createTable('NurseLeaves', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        nurseId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Nurses', key: 'id' }, onDelete: 'CASCADE',
        },
        leaveDate: { type: Sequelize.DATEONLY, allowNull: false },
        reason: { type: Sequelize.STRING },
        isFullDay: { type: Sequelize.BOOLEAN, defaultValue: true },
        startTime: { type: Sequelize.TIME, allowNull: true },
        endTime: { type: Sequelize.TIME, allowNull: true },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'rejected'),
          defaultValue: 'pending',
        },
        approvedByUserId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL',
        },
        approvalDate: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // 7. Update IPDNotes
    const noteCols = await queryInterface.describeTable('IPDNotes');
    if (!noteCols.nurseId) {
      await queryInterface.addColumn('IPDNotes', 'nurseId', {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'Nurses', key: 'id' }, onDelete: 'SET NULL',
      });
    }
    await queryInterface.changeColumn('IPDNotes', 'doctorId', {
      type: Sequelize.UUID, allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('NurseLeaves').catch(() => {});
    await queryInterface.dropTable('NursePatientAssignments').catch(() => {});
    await queryInterface.dropTable('NurseShiftAssignments').catch(() => {});
    await queryInterface.dropTable('Shifts').catch(() => {});
    await queryInterface.dropTable('Nurses').catch(() => {});
    await queryInterface.removeColumn('IPDNotes', 'nurseId').catch(() => {});
  },
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // ─── Rooms ────────────────────────────────────────────────
    if (!tables.includes('Rooms')) {
      await queryInterface.createTable('Rooms', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' }, onDelete: 'CASCADE',
        },
        roomNumber: { type: Sequelize.STRING, allowNull: false },
        roomType: {
          type: Sequelize.ENUM('general', 'semi_private', 'private', 'icu', 'emergency'),
          defaultValue: 'general',
        },
        floor: { type: Sequelize.STRING },
        totalBeds: { type: Sequelize.INTEGER, defaultValue: 1 },
        pricePerDay: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        description: { type: Sequelize.TEXT },
        isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ─── IPDAdmissions ────────────────────────────────────────
    if (!tables.includes('IPDAdmissions')) {
      await queryInterface.createTable('IPDAdmissions', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        admissionNumber: { type: Sequelize.STRING, unique: true },
        patientId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Patients', key: 'id' }, onDelete: 'CASCADE',
        },
        doctorId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Doctors', key: 'id' }, onDelete: 'CASCADE',
        },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' }, onDelete: 'CASCADE',
        },
        roomId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Rooms', key: 'id' }, onDelete: 'SET NULL',
        },
        admissionDate: { type: Sequelize.DATEONLY, allowNull: false },
        dischargeDate: { type: Sequelize.DATEONLY, allowNull: true },
        admissionDiagnosis: { type: Sequelize.TEXT },
        finalDiagnosis: { type: Sequelize.TEXT },
        admissionType: {
          type: Sequelize.ENUM('emergency', 'planned', 'transfer'),
          defaultValue: 'planned',
        },
        status: {
          type: Sequelize.ENUM('admitted', 'discharged', 'transferred'),
          defaultValue: 'admitted',
        },
        totalAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        paidAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        isPaid: { type: Sequelize.BOOLEAN, defaultValue: false },
        notes: { type: Sequelize.TEXT },
        dischargeNotes: { type: Sequelize.TEXT },
        conditionAtDischarge: {
          type: Sequelize.ENUM('stable', 'improved', 'lama', 'expired', 'transferred'),
          allowNull: true,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ─── IPDNotes ─────────────────────────────────────────────
    if (!tables.includes('IPDNotes')) {
      await queryInterface.createTable('IPDNotes', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        admissionId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'IPDAdmissions', key: 'id' }, onDelete: 'CASCADE',
        },
        doctorId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Doctors', key: 'id' }, onDelete: 'CASCADE',
        },
        noteType: {
          type: Sequelize.ENUM('progress', 'nursing', 'orders', 'consultation'),
          defaultValue: 'progress',
        },
        content: { type: Sequelize.TEXT, allowNull: false },
        noteDate: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('IPDNotes').catch(() => {});
    await queryInterface.dropTable('IPDAdmissions').catch(() => {});
    await queryInterface.dropTable('Rooms').catch(() => {});
  },
};

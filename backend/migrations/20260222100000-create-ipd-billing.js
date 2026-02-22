'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // ─── IPDBillItems ──────────────────────────────────────────────────────────
    if (!tables.includes('IPDBillItems')) {
      await queryInterface.createTable('IPDBillItems', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        admissionId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'IPDAdmissions', key: 'id' },
          onDelete: 'CASCADE',
        },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onDelete: 'CASCADE',
        },
        itemType: {
          type: Sequelize.ENUM('room_charges', 'consultation', 'procedure', 'lab_test', 'medication', 'ot_charges', 'nursing', 'equipment', 'other'),
          defaultValue: 'other',
        },
        description: { type: Sequelize.TEXT, allowNull: false },
        quantity: { type: Sequelize.DECIMAL(10, 3), defaultValue: 1 },
        unitPrice: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        amount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        gstRate: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
        gstAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        totalWithGst: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        isPackageCovered: { type: Sequelize.BOOLEAN, defaultValue: false },
        packageId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'PatientPackages', key: 'id' },
          onDelete: 'SET NULL',
        },
        date: { type: Sequelize.DATEONLY },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ─── IPDPayments ───────────────────────────────────────────────────────────
    if (!tables.includes('IPDPayments')) {
      await queryInterface.createTable('IPDPayments', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        admissionId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'IPDAdmissions', key: 'id' },
          onDelete: 'CASCADE',
        },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onDelete: 'CASCADE',
        },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        paymentMethod: {
          type: Sequelize.ENUM('cash', 'card', 'upi', 'insurance', 'corporate', 'cheque', 'online', 'other'),
          defaultValue: 'cash',
        },
        referenceNumber: { type: Sequelize.STRING },
        paymentDate: { type: Sequelize.DATEONLY },
        notes: { type: Sequelize.TEXT },
        createdByUserId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' },
          onDelete: 'SET NULL',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // ─── Alter IPDAdmissions — add billing columns ─────────────────────────────
    const admissionCols = await queryInterface.describeTable('IPDAdmissions');

    if (!admissionCols.billedAmount) {
      await queryInterface.addColumn('IPDAdmissions', 'billedAmount', {
        type: Sequelize.DECIMAL(10, 2), defaultValue: 0,
      });
    }
    if (!admissionCols.discountAmount) {
      await queryInterface.addColumn('IPDAdmissions', 'discountAmount', {
        type: Sequelize.DECIMAL(10, 2), defaultValue: 0,
      });
    }
    if (!admissionCols.paymentStatus) {
      await queryInterface.addColumn('IPDAdmissions', 'paymentStatus', {
        type: Sequelize.ENUM('pending', 'partial', 'paid'), defaultValue: 'pending',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('IPDBillItems').catch(() => {});
    await queryInterface.dropTable('IPDPayments').catch(() => {});
    await queryInterface.removeColumn('IPDAdmissions', 'billedAmount').catch(() => {});
    await queryInterface.removeColumn('IPDAdmissions', 'discountAmount').catch(() => {});
    await queryInterface.removeColumn('IPDAdmissions', 'paymentStatus').catch(() => {});
  },
};

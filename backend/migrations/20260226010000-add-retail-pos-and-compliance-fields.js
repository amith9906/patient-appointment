'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [medicationCols, invoiceCols, itemCols] = await Promise.all([
      queryInterface.describeTable('Medications'),
      queryInterface.describeTable('MedicineInvoices'),
      queryInterface.describeTable('MedicineInvoiceItems'),
    ]);

    if (!medicationCols.scheduleCategory) {
      await queryInterface.addColumn('Medications', 'scheduleCategory', {
        type: Sequelize.STRING(40),
        allowNull: true,
      });
    }
    if (!medicationCols.isRestrictedDrug) {
      await queryInterface.addColumn('Medications', 'isRestrictedDrug', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!medicationCols.interactsWith) {
      await queryInterface.addColumn('Medications', 'interactsWith', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }

    if (!invoiceCols.paymentBreakup) {
      await queryInterface.addColumn('MedicineInvoices', 'paymentBreakup', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      });
    }
    if (!invoiceCols.paidAmount) {
      await queryInterface.addColumn('MedicineInvoices', 'paidAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!invoiceCols.roundOffAmount) {
      await queryInterface.addColumn('MedicineInvoices', 'roundOffAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!invoiceCols.grandTotal) {
      await queryInterface.addColumn('MedicineInvoices', 'grandTotal', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!invoiceCols.deliveryStatus) {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_MedicineInvoices_deliveryStatus') THEN
            CREATE TYPE "enum_MedicineInvoices_deliveryStatus" AS ENUM ('pending', 'out_for_delivery', 'delivered_paid');
          END IF;
        END $$;
      `);
      await queryInterface.addColumn('MedicineInvoices', 'deliveryStatus', {
        type: Sequelize.ENUM('pending', 'out_for_delivery', 'delivered_paid'),
        allowNull: false,
        defaultValue: 'pending',
      });
    }
    if (!invoiceCols.deliveryAssignedTo) {
      await queryInterface.addColumn('MedicineInvoices', 'deliveryAssignedTo', {
        type: Sequelize.STRING(120),
      });
    }
    if (!invoiceCols.deliveryNotes) {
      await queryInterface.addColumn('MedicineInvoices', 'deliveryNotes', {
        type: Sequelize.TEXT,
      });
    }

    if (!itemCols.cgstPct) {
      await queryInterface.addColumn('MedicineInvoiceItems', 'cgstPct', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!itemCols.sgstPct) {
      await queryInterface.addColumn('MedicineInvoiceItems', 'sgstPct', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!itemCols.cgstAmount) {
      await queryInterface.addColumn('MedicineInvoiceItems', 'cgstAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!itemCols.sgstAmount) {
      await queryInterface.addColumn('MedicineInvoiceItems', 'sgstAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!itemCols.isRestrictedDrug) {
      await queryInterface.addColumn('MedicineInvoiceItems', 'isRestrictedDrug', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!itemCols.prescriberDoctorName) {
      await queryInterface.addColumn('MedicineInvoiceItems', 'prescriberDoctorName', {
        type: Sequelize.STRING(140),
      });
    }
  },

  async down(queryInterface) {
    const safeDrop = async (table, column) => {
      const cols = await queryInterface.describeTable(table);
      if (cols[column]) await queryInterface.removeColumn(table, column);
    };

    await safeDrop('MedicineInvoiceItems', 'prescriberDoctorName');
    await safeDrop('MedicineInvoiceItems', 'isRestrictedDrug');
    await safeDrop('MedicineInvoiceItems', 'sgstAmount');
    await safeDrop('MedicineInvoiceItems', 'cgstAmount');
    await safeDrop('MedicineInvoiceItems', 'sgstPct');
    await safeDrop('MedicineInvoiceItems', 'cgstPct');

    await safeDrop('MedicineInvoices', 'deliveryNotes');
    await safeDrop('MedicineInvoices', 'deliveryAssignedTo');
    await safeDrop('MedicineInvoices', 'deliveryStatus');
    await safeDrop('MedicineInvoices', 'grandTotal');
    await safeDrop('MedicineInvoices', 'roundOffAmount');
    await safeDrop('MedicineInvoices', 'paidAmount');
    await safeDrop('MedicineInvoices', 'paymentBreakup');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MedicineInvoices_deliveryStatus";');

    await safeDrop('Medications', 'interactsWith');
    await safeDrop('Medications', 'isRestrictedDrug');
    await safeDrop('Medications', 'scheduleCategory');
  },
};


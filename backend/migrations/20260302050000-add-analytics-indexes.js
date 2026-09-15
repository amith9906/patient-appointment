'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(t => typeof t === 'string' ? t.toLowerCase() : (t.tableName || t.tablename || '').toLowerCase());

    if (tableNames.includes('patients')) {
      try {
        await queryInterface.addIndex('Patients', ['hospitalId', 'referralSource', 'isActive'], {
          name: 'idx_patients_hospital_referral_active'
        });
      } catch (err) {
        console.log('Patients referral index exists or skipped:', err.message);
      }
    }

    if (tableNames.includes('appointments')) {
      try {
        await queryInterface.addIndex('Appointments', ['appointmentDate', 'status'], {
          name: 'idx_appointments_date_status'
        });
      } catch (err) {
        console.log('Appointments date_status index exists or skipped:', err.message);
      }
    }

    if (tableNames.includes('ipdpayments')) {
      try {
        await queryInterface.addIndex('IPDPayments', ['hospitalId', 'paymentDate'], {
          name: 'idx_ipdpayments_hospital_date'
        });
      } catch (err) {
        console.log('IPDPayments date index exists or skipped:', err.message);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('Patients', 'idx_patients_hospital_referral_active');
      await queryInterface.removeIndex('Appointments', 'idx_appointments_date_status');
      await queryInterface.removeIndex('IPDPayments', 'idx_ipdpayments_hospital_date');
    } catch (err) {}
  }
};

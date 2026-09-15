'use strict';

function normalizeTableName(tableName) {
  if (typeof tableName === 'string') return tableName.toLowerCase();
  if (tableName && typeof tableName === 'object') {
    return String(tableName.tableName || tableName.tablename || '').toLowerCase();
  }
  return '';
}

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(normalizeTableName);

    // Appointments Indexes
    if (tableNames.includes('appointments')) {
      try {
        await queryInterface.addIndex('Appointments', ['doctorId', 'appointmentDate', 'status'], {
          name: 'idx_appointments_doctor_date_status',
        });
        await queryInterface.addIndex('Appointments', ['patientId', 'appointmentDate'], {
          name: 'idx_appointments_patient_date',
        });
      } catch (err) {
        console.log('Appointments index skipped / exists:', err.message);
      }
    }

    // Medications Indexes
    if (tableNames.includes('medications')) {
      try {
        await queryInterface.addIndex('Medications', ['hospitalId', 'expiryDate'], {
          name: 'idx_medications_hospital_expiry',
        });
      } catch (err) {
        console.log('Medications index skipped / exists:', err.message);
      }
    }

    // IPD Admissions Indexes
    if (tableNames.includes('ipdadmissions')) {
      try {
        await queryInterface.addIndex('IPDAdmissions', ['hospitalId', 'status'], {
          name: 'idx_ipd_hospital_status',
        });
        await queryInterface.addIndex('IPDAdmissions', ['patientId'], {
          name: 'idx_ipd_patient',
        });
      } catch (err) {
        console.log('IPDAdmissions index skipped / exists:', err.message);
      }
    }

    // BillItems Index
    if (tableNames.includes('billitems')) {
      try {
        await queryInterface.addIndex('BillItems', ['appointmentId'], {
          name: 'idx_billitems_appointment',
        });
      } catch (err) {
        console.log('BillItems index skipped / exists:', err.message);
      }
    }

    // IPDBillItems Index
    if (tableNames.includes('ipdbillitems')) {
      try {
        await queryInterface.addIndex('IPDBillItems', ['admissionId'], {
          name: 'idx_ipdbillitems_admission',
        });
      } catch (err) {
        console.log('IPDBillItems index skipped / exists:', err.message);
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(normalizeTableName);

    if (tableNames.includes('appointments')) {
      await queryInterface.removeIndex('Appointments', 'idx_appointments_doctor_date_status').catch(() => {});
      await queryInterface.removeIndex('Appointments', 'idx_appointments_patient_date').catch(() => {});
    }
    if (tableNames.includes('medications')) {
      await queryInterface.removeIndex('Medications', 'idx_medications_hospital_expiry').catch(() => {});
    }
    if (tableNames.includes('ipdadmissions')) {
      await queryInterface.removeIndex('IPDAdmissions', 'idx_ipd_hospital_status').catch(() => {});
      await queryInterface.removeIndex('IPDAdmissions', 'idx_ipd_patient').catch(() => {});
    }
    if (tableNames.includes('billitems')) {
      await queryInterface.removeIndex('BillItems', 'idx_billitems_appointment').catch(() => {});
    }
    if (tableNames.includes('ipdbillitems')) {
      await queryInterface.removeIndex('IPDBillItems', 'idx_ipdbillitems_admission').catch(() => {});
    }
  },
};

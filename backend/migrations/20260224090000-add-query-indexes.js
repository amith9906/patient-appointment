'use strict';

module.exports = {
  async up(queryInterface) {
    await Promise.all([
      queryInterface.addIndex('Appointments', ['doctorId', 'appointmentDate'], {
        name: 'appointments_doctor_date_idx',
      }),
      queryInterface.addIndex('IPDAdmissions', ['hospitalId', 'status', 'admissionDate'], {
        name: 'ipdadmissions_hospital_status_date_idx',
      }),
      queryInterface.addIndex('Medications', ['hospitalId', 'expiryDate'], {
        name: 'medications_hospital_expiry_idx',
      }),
    ]);
  },

  async down(queryInterface) {
    await Promise.all([
      queryInterface.removeIndex('Appointments', 'appointments_doctor_date_idx'),
      queryInterface.removeIndex('IPDAdmissions', 'ipdadmissions_hospital_status_date_idx'),
      queryInterface.removeIndex('Medications', 'medications_hospital_expiry_idx'),
    ]);
  },
};

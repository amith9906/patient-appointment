'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON "Prescriptions" ("appointmentId");
      CREATE INDEX IF NOT EXISTS idx_labtests_patient_id ON "LabTests" ("patientId");
      CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON "Reports" ("patientId");
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_date_time ON "Appointments" ("patientId", "appointmentDate" DESC, "appointmentTime" DESC);
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_prescriptions_appointment_id;
      DROP INDEX IF EXISTS idx_labtests_patient_id;
      DROP INDEX IF EXISTS idx_reports_patient_id;
      DROP INDEX IF EXISTS idx_appointments_patient_date_time;
    `);
  }
};

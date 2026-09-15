'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_nurses_user_id ON "Nurses" ("userId");
      CREATE INDEX IF NOT EXISTS idx_patients_user_id ON "Patients" ("userId");
      CREATE INDEX IF NOT EXISTS idx_billitems_appointment_id ON "BillItems" ("appointmentId");
      CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON "Prescriptions" ("appointmentId");
      CREATE INDEX IF NOT EXISTS idx_labtests_appointment_id ON "LabTests" ("appointmentId");
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_nurses_user_id;
      DROP INDEX IF EXISTS idx_patients_user_id;
      DROP INDEX IF EXISTS idx_billitems_appointment_id;
      DROP INDEX IF EXISTS idx_prescriptions_appointment_id;
      DROP INDEX IF EXISTS idx_labtests_appointment_id;
    `);
  }
};

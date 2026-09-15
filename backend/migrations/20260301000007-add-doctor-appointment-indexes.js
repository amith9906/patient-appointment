'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addIndex('Doctors', ['userId'], {
        name: 'doctors_user_id_idx',
      });
    } catch (e) {
      console.log('Index doctors_user_id_idx already exists or skipped:', e.message);
    }

    try {
      await queryInterface.addIndex('Appointments', ['doctorId', 'appointmentDate', 'appointmentTime'], {
        name: 'appointments_doctor_date_time_idx',
      });
    } catch (e) {
      console.log('Index appointments_doctor_date_time_idx already exists or skipped:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('Doctors', 'doctors_user_id_idx');
      await queryInterface.removeIndex('Appointments', 'appointments_doctor_date_time_idx');
    } catch (e) {}
  },
};

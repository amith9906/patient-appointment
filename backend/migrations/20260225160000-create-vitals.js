'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Vitals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      admissionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'IPDAdmissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      appointmentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Appointments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nurseId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Nurses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      temp: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      pulse: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      bp_systolic: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      bp_diastolic: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      spO2: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      respRate: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      weight: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      recordedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Indexes for performance (create only if columns exist to avoid failures)
    const desc = await queryInterface.describeTable('Vitals').catch(() => ({}));
    if (desc && (desc.admissionId || desc.admission_id)) {
      const col = desc.admissionId ? 'admissionId' : 'admission_id';
      await queryInterface.addIndex('Vitals', [col], { name: 'vitals_admission_id' });
    }
    if (desc && (desc.recordedAt || desc.recorded_at)) {
      const colRec = desc.recordedAt ? 'recordedAt' : 'recorded_at';
      await queryInterface.addIndex('Vitals', [colRec], { name: 'vitals_recorded_at' });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Vitals');
  }
};

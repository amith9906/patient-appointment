'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DrugInteractions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      drugA: {
        type: Sequelize.STRING,
        allowNull: false
      },
      drugB: {
        type: Sequelize.STRING,
        allowNull: false
      },
      severity: {
        type: Sequelize.ENUM('Major', 'Moderate', 'Minor'),
        allowNull: false,
        defaultValue: 'Moderate'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      clinicalAction: {
        type: Sequelize.TEXT
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

    await queryInterface.createTable('DrugSafetyProfiles', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      drugName: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      pregnancyCategory: {
        type: Sequelize.ENUM('Safe', 'Use with caution', 'Contraindicated'),
        allowNull: false,
        defaultValue: 'Safe'
      },
      egfrThreshold: {
        type: Sequelize.FLOAT,
        comment: 'eGFR in mL/min/1.73m2 below which renal adjustment is required'
      },
      renalAdjustmentAdvice: {
        type: Sequelize.TEXT
      },
      hepaticWarning: {
        type: Sequelize.TEXT
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

    await queryInterface.createTable('DoseRangeRules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      drugName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      patientGroup: {
        type: Sequelize.ENUM('Adult', 'Pediatric', 'Geriatric'),
        allowNull: false
      },
      maxDailyDoseMg: {
        type: Sequelize.FLOAT,
        allowNull: false
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

    await queryInterface.createTable('ClinicalOverrideLogs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      alertType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      alertDetails: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      overrideReason: {
        type: Sequelize.TEXT,
        allowNull: false
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ClinicalOverrideLogs');
    await queryInterface.dropTable('DoseRangeRules');
    await queryInterface.dropTable('DrugSafetyProfiles');
    await queryInterface.dropTable('DrugInteractions');
  }
};

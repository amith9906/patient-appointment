'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SecurityEvents', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      hospitalId: {
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      eventType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      severity: {
        type: Sequelize.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
        defaultValue: 'MEDIUM'
      },
      ipAddress: {
        type: Sequelize.STRING
      },
      details: {
        type: Sequelize.JSONB
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

    await queryInterface.createTable('AccessViolations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      hospitalId: {
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      attemptedPath: {
        type: Sequelize.STRING,
        allowNull: false
      },
      requiredRole: {
        type: Sequelize.STRING
      },
      actualRole: {
        type: Sequelize.STRING
      },
      ipAddress: {
        type: Sequelize.STRING
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

    await queryInterface.createTable('DataAccessLogs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      accessedFields: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false
      },
      purpose: {
        type: Sequelize.STRING,
        defaultValue: 'CLINICAL_TREATMENT'
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
    await queryInterface.dropTable('DataAccessLogs');
    await queryInterface.dropTable('AccessViolations');
    await queryInterface.dropTable('SecurityEvents');
  }
};

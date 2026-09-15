'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MasterCatalogs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      catalogCode: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      catalogName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM('Doctors', 'Departments', 'Drugs', 'Procedures', 'ICD10', 'SNOMED', 'Lab', 'Radiology'),
        allowNull: false
      },
      activeVersion: {
        type: Sequelize.STRING,
        defaultValue: 'v1.0.0'
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

    await queryInterface.createTable('CatalogVersions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      masterCatalogId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'MasterCatalogs', key: 'id' },
        onDelete: 'CASCADE'
      },
      version: {
        type: Sequelize.STRING,
        allowNull: false
      },
      dataPayload: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      publishedBy: {
        type: Sequelize.INTEGER
      },
      publishedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
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

    await queryInterface.createTable('CatalogSyncJobs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      catalogVersionId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      targetHospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'),
        defaultValue: 'PENDING'
      },
      syncedAt: {
        type: Sequelize.DATE
      },
      errorMessage: {
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CatalogSyncJobs');
    await queryInterface.dropTable('CatalogVersions');
    await queryInterface.dropTable('MasterCatalogs');
  }
};

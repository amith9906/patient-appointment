'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('LabReportTemplates')) {
      await queryInterface.createTable('LabReportTemplates', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        category: { type: Sequelize.STRING },
        description: { type: Sequelize.TEXT },
        fields: { type: Sequelize.JSONB, defaultValue: [] },
        isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
        hospitalId: { type: Sequelize.UUID, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    // Add templateId + templateValues + abnormalFields to LabTests
    const cols = await queryInterface.describeTable('LabTests');
    if (!cols.templateId) {
      await queryInterface.addColumn('LabTests', 'templateId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'LabReportTemplates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!cols.templateValues) {
      await queryInterface.addColumn('LabTests', 'templateValues', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
    if (!cols.abnormalFields) {
      await queryInterface.addColumn('LabTests', 'abnormalFields', {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('LabTests', 'abnormalFields');
    await queryInterface.removeColumn('LabTests', 'templateValues');
    await queryInterface.removeColumn('LabTests', 'templateId');
    await queryInterface.dropTable('LabReportTemplates');
  },
};

"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ClinicalNotes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      patientId: { type: Sequelize.UUID, allowNull: false },
      encounterId: { type: Sequelize.UUID, allowNull: true },
      authorId: { type: Sequelize.UUID, allowNull: false },
      authorRole: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: true },
      content: { type: Sequelize.JSONB, allowNull: true },
      status: { type: Sequelize.ENUM('draft', 'signed', 'amended'), allowNull: false, defaultValue: 'draft' },
      signedAt: { type: Sequelize.DATE, allowNull: true },
      parentNoteId: { type: Sequelize.UUID, allowNull: true },
      audit: { type: Sequelize.JSONB, allowNull: true },
      attachments: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ClinicalNotes');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_ClinicalNotes_status\";");
  }
};

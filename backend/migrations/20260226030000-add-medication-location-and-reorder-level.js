'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Medications');

    if (!cols.location) {
      await queryInterface.addColumn('Medications', 'location', {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'Rack / shelf mapping, e.g. Shelf A, Box 4',
      });
    }

    if (!cols.reorderLevel) {
      await queryInterface.addColumn('Medications', 'reorderLevel', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10,
      });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('Medications');
    if (cols.reorderLevel) {
      await queryInterface.removeColumn('Medications', 'reorderLevel');
    }
    if (cols.location) {
      await queryInterface.removeColumn('Medications', 'location');
    }
  },
};
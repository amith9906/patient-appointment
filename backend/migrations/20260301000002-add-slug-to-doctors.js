'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Doctors');
    if (!tableInfo.slug) {
      await queryInterface.addColumn('Doctors', 'slug', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });

      // Populate existing doctors with unique slugs
      const [doctors] = await queryInterface.sequelize.query('SELECT id, name FROM "Doctors";');
      for (const doc of doctors) {
        const cleanName = String(doc.name || 'doctor')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const shortId = String(doc.id).split('-')[0] || Math.random().toString(36).substring(2, 8);
        const slug = `dr-${cleanName}-${shortId}`;
        await queryInterface.sequelize.query(
          'UPDATE "Doctors" SET "slug" = :slug WHERE "id" = :id;',
          { replacements: { slug, id: doc.id } }
        );
      }
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('Doctors');
    if (tableInfo.slug) {
      await queryInterface.removeColumn('Doctors', 'slug');
    }
  },
};

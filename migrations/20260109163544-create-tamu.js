'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Tamus', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id_tamu: {
        type: Sequelize.STRING,
        unique: true, // Agar ID tidak ada yang kembar
        allowNull: false
      },
      nama: { type: Sequelize.STRING, allowNull: false },
      nip: { type: Sequelize.STRING, allowNull: true },
      jabatan: { type: Sequelize.STRING, allowNull: true },
      pekerjaan: { type: Sequelize.STRING, allowNull: true },
      unit_kerja: { type: Sequelize.STRING, allowNull: true },
      no_kontak: { type: Sequelize.STRING, allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Tamus');
  }
};
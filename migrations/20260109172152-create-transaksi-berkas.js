'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('TransaksiBerkas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tamuId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tamus', key: 'id' }, // Nyambung ke tabel Tamu
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tgl_transaksi: { type: Sequelize.DATEONLY, allowNull: false },
      perihal: { type: Sequelize.STRING, allowNull: false },
      tujuan: { type: Sequelize.STRING, allowNull: false },
      penerima: { type: Sequelize.STRING, allowNull: false }, // Nama FO yang bertugas
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('TransaksiBerkas');
  }
};
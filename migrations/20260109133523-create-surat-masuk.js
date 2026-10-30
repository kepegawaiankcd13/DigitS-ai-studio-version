'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('SuratMasuks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tgl_terima: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      tgl_surat: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      nomor_surat: {
        type: Sequelize.STRING,
        allowNull: false
      },
      pengirim: {
        type: Sequelize.STRING,
        allowNull: false
      },
      perihal: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      tgl_pelaksanaan: {
        type: Sequelize.STRING, // Menggunakan string untuk rentang (ex: 10 s/d 12 Jan)
        allowNull: true
      },
      urgensi: {
        type: Sequelize.ENUM('Amat Segera', 'Segera', 'Penting', 'Biasa'),
        defaultValue: 'Biasa'
      },
      sifat: {
        type: Sequelize.ENUM('Biasa', 'Konfidential', 'Penting', 'Rahasia', 'Sangat Rahasia'),
        defaultValue: 'Biasa'
      },
      file_pdf: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status_disposisi: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      // Kolom tambahan untuk kebutuhan form disposisi nanti
      tujuan_disposisi: {
        type: Sequelize.STRING,
        allowNull: true
      },
      catatan_disposisi: {
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
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('SuratMasuks');
  }
};
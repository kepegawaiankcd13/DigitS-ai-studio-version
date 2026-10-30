'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SuratMasuk extends Model {
    static associate(models) {}
  }
  SuratMasuk.init({
    tgl_terima: DataTypes.DATEONLY,
    tgl_surat: DataTypes.DATEONLY,
    nomor_surat: DataTypes.STRING,
    pengirim: DataTypes.STRING,
    perihal: DataTypes.TEXT,
    tgl_pelaksanaan: DataTypes.STRING,
    urgensi: DataTypes.STRING,
    sifat: DataTypes.STRING,
    file_pdf: DataTypes.STRING,
    status_disposisi: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    tujuan_disposisi: DataTypes.STRING,
    catatan_disposisi: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'SuratMasuk',
    tableName: 'suratmasuks'
  });
  return SuratMasuk;
};
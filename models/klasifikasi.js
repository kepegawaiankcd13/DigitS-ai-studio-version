'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Klasifikasi extends Model {
    static associate(models) {
      if (models.TransaksiSurat) {
        this.hasMany(models.TransaksiSurat, { foreignKey: 'klasifikasiId' });
      }
    }
  }
  Klasifikasi.init({
    kode: DataTypes.STRING,
    nama: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Klasifikasi',
    tableName: 'klasifikasis',
  });
  return Klasifikasi;
};
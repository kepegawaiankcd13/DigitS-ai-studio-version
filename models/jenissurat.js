'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class JenisSurat extends Model {
    static associate(models) {
      if (models.TransaksiSurat) {
        this.hasMany(models.TransaksiSurat, { foreignKey: 'jenisId' });
      }
    }
  }
  JenisSurat.init({
    kode_jenis: DataTypes.STRING,
    nama_jenis: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'JenisSurat',
    tableName: 'jenissurats'
  });
  return JenisSurat;
};
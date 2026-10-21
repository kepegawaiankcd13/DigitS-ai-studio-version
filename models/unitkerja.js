'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UnitKerja extends Model {
    static associate(models) {
      if (models.TransaksiSurat) {
        this.hasMany(models.TransaksiSurat, { foreignKey: 'unitId' });
      }
    }
  }
  UnitKerja.init({
    nama_unit: DataTypes.STRING,
    kode_unit: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'UnitKerja',
    tableName: 'unitkerjas'
  });
  return UnitKerja;
};
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Tamu extends Model {
    static associate(models) {
      this.hasMany(models.TransaksiBerkas, { foreignKey: 'tamuId' });
    }
  }
  Tamu.init({
    id_tamu: DataTypes.STRING,
    nama: DataTypes.STRING,
    nip: DataTypes.STRING,
    jabatan: DataTypes.STRING,
    pekerjaan: DataTypes.STRING,
    unit_kerja: DataTypes.STRING,
    no_kontak: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Tamu',
    tableName: 'tamus'
  });
  return Tamu;
};
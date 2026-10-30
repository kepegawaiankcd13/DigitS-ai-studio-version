'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TransaksiBerkas extends Model {
    static associate(models) {
      this.belongsTo(models.Tamu, { foreignKey: 'tamuId', as: 'tamu' });
      this.belongsTo(models.Tamu, { foreignKey: 'tamuId', as: 'Tamu' });
    }
  }
  TransaksiBerkas.init({
    tamuId: DataTypes.INTEGER,
    tgl_transaksi: DataTypes.DATE,
    perihal: DataTypes.STRING,
    tujuan: DataTypes.STRING,
    penerima: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'TransaksiBerkas',
    tableName: 'transaksiberkas'
  });
  return TransaksiBerkas;
};
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TransaksiSurat extends Model {
    static associate(models) {
      this.belongsTo(models.JenisSurat, { foreignKey: 'jenisId' });
      this.belongsTo(models.UnitKerja, { foreignKey: 'unitId' });
      this.belongsTo(models.User, { foreignKey: 'userId' });
      this.belongsTo(models.Klasifikasi, { foreignKey: 'klasifikasiId' });
    }
  }
  TransaksiSurat.init({
    nomor_urut: DataTypes.INTEGER,
    nomor_lengkap: DataTypes.STRING,
    perihal: DataTypes.STRING,
    tanggal_nomor: DataTypes.DATEONLY,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Aktif'
    },
    userId: DataTypes.INTEGER,
    jenisId: DataTypes.INTEGER,
    unitId: DataTypes.INTEGER,
    klasifikasiId: DataTypes.INTEGER,
    file_pdf: DataTypes.STRING,
    is_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'TransaksiSurat',
    tableName: 'transaksisurats'
  });
  return TransaksiSurat;
};
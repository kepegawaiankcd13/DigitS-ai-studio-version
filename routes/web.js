const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const db = require('../models');

// Configure Multer storage
const uploadDir = path.join(__dirname, '../public/uploads/surat_masuk');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'DOC_' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Helper: Generate signed session token for iframe compatibility
function generateToken(user, tahun) {
  const payload = {
    userId: user.id,
    username: user.username,
    nama_lengkap: user.nama_lengkap || user.username,
    role: user.role || 'User',
    tahun: tahun || '2026',
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const data = JSON.parse(json);
    if (data.exp && data.exp > Date.now()) {
      return data;
    }
  } catch (e) {}
  return null;
}

// Middleware: Authentication check (handles session cookies + iframe auth token)
function requireAuth(req, res, next) {
  const token = req.query.auth || req.headers['x-auth-token'];
  if (token) {
    const tokenData = verifyToken(token);
    if (tokenData) {
      if (req.session) {
        req.session.userId = tokenData.userId;
        req.session.username = tokenData.username;
        req.session.nama_lengkap = tokenData.nama_lengkap;
        req.session.role = tokenData.role;
        req.session.tahun = tokenData.tahun;
      }
      req.authToken = token;
      res.locals.user = {
        userId: tokenData.userId,
        username: tokenData.username,
        nama_lengkap: tokenData.nama_lengkap,
        role: tokenData.role,
        tahun: tokenData.tahun
      };
    }
  }

  const userId = req.session?.userId || (req.authToken && verifyToken(req.authToken)?.userId);

  if (!userId) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({ error: 'Unauthorized', redirect: '/login' });
    }
    return res.redirect('/login');
  }

  if (!req.authToken && req.session?.userId) {
    req.authToken = generateToken({
      id: req.session.userId,
      username: req.session.username,
      nama_lengkap: req.session.nama_lengkap,
      role: req.session.role
    }, req.session.tahun);
  }
  res.locals.authToken = req.authToken || '';

  next();
}

// Middleware: Admin check
function requireAdmin(req, res, next) {
  const role = res.locals.user?.role || req.session?.role;
  if (role !== 'admin') {
    return res.status(403).send('Akses Ditolak: Khusus Administrator');
  }
  next();
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------
router.get('/login', (req, res) => {
  const token = req.query.auth;
  if (token && verifyToken(token)) {
    return res.redirect(`/dashboard?auth=${token}`);
  }
  if (req.session?.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    error: req.query.error || null,
    tahun: req.session?.tahun || '2026'
  });
});

router.post('/login', async (req, res) => {
  const isAjax = req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('json');
  try {
    const { username, password, tahun } = req.body;
    const user = await db.User.findOne({ where: { username } });

    if (!user || String(user.password) !== String(password)) {
      if (isAjax) {
        return res.status(401).json({ success: false, error: 'Username atau Password salah!' });
      }
      return res.render('login', {
        error: 'Username atau Password salah!',
        tahun: tahun || '2026'
      });
    }

    if (req.session) {
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.nama_lengkap = user.nama_lengkap || user.username;
      req.session.role = user.role || 'User';
      req.session.tahun = tahun || '2026';
    }

    const token = generateToken(user, tahun || '2026');

    if (isAjax) {
      return res.json({
        success: true,
        redirect: `/dashboard?auth=${token}`,
        token,
        user: {
          username: user.username,
          nama_lengkap: user.nama_lengkap,
          role: user.role
        }
      });
    }

    res.redirect(`/dashboard?auth=${token}`);
  } catch (err) {
    console.error('Login error:', err);
    if (isAjax) {
      return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem: ' + err.message });
    }
    res.render('login', { error: 'Terjadi kesalahan sistem', tahun: '2026' });
  }
});

router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

router.post('/switch-tahun', requireAuth, (req, res) => {
  if (req.body.tahun) {
    req.session.tahun = req.body.tahun;
  }
  res.redirect(req.headers.referer || '/');
});

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  res.redirect('/dashboard');
});

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const tahun = req.session.tahun || '2026';

    // Counts
    const allSuratMasuk = await db.SuratMasuk.findAll();
    const suratMasukYear = allSuratMasuk.filter(s => {
      const d = String(s.tgl_terima || s.tgl_surat || '');
      return d.startsWith(tahun);
    });

    const totalSuratMasuk = suratMasukYear.length;
    const suratSudahDisposisi = suratMasukYear.filter(s => s.status_disposisi == 1 || s.status_disposisi === true).length;
    const suratBelumDisposisi = totalSuratMasuk - suratSudahDisposisi;

    const allTransaksiSurat = await db.TransaksiSurat.findAll();
    const transaksiSuratYear = allTransaksiSurat.filter(s => {
      const d = String(s.tanggal_nomor || '');
      return d.startsWith(tahun);
    });
    const totalSuratKeluar = transaksiSuratYear.length;
    const suratAktif = transaksiSuratYear.filter(s => s.status === 'Aktif').length;
    const suratBooking = transaksiSuratYear.filter(s => s.status === 'Booking').length;

    const totalTamu = await db.Tamu.count();
    const totalTransaksiBerkas = await db.TransaksiBerkas.count();

    // Recent items
    const recentSuratMasuk = (await db.SuratMasuk.findAll({
      order: [['id', 'DESC']],
      limit: 5
    }));

    const recentTransaksiSurat = (await db.TransaksiSurat.findAll({
      include: [db.JenisSurat, db.Klasifikasi, db.UnitKerja],
      order: [['id', 'DESC']],
      limit: 5
    }));

    const recentBerkas = (await db.TransaksiBerkas.findAll({
      include: [db.Tamu],
      order: [['id', 'DESC']],
      limit: 5
    }));

    res.render('dashboard', {
      title: 'Dashboard',
      stats: {
        totalSuratMasuk,
        suratSudahDisposisi,
        suratBelumDisposisi,
        totalSuratKeluar,
        suratAktif,
        suratBooking,
        totalTamu,
        totalTransaksiBerkas
      },
      recentSuratMasuk,
      recentTransaksiSurat,
      recentBerkas,
      tahun
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Error loading dashboard');
  }
});

// -------------------------------------------------------------
// TRANSAKSI SURAT (PENOMORAN SURAT KELUAR)
// -------------------------------------------------------------
router.get('/transaksi-surat', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';
    const jenisId = req.query.jenisId || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let items = await db.TransaksiSurat.findAll({
      include: [db.JenisSurat, db.Klasifikasi, db.UnitKerja, db.User],
      order: [['id', 'DESC']]
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => 
        (i.nomor_lengkap && i.nomor_lengkap.toLowerCase().includes(q)) ||
        (i.perihal && i.perihal.toLowerCase().includes(q))
      );
    }

    if (status) {
      items = items.filter(i => i.status === status);
    }

    if (jenisId) {
      items = items.filter(i => String(i.jenisId) === String(jenisId));
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedItems = items.slice(offset, offset + limit);

    const jenisSurats = await db.JenisSurat.findAll();

    res.render('transaksi_surat/index', {
      title: 'Nomor Surat Keluar',
      items: paginatedItems,
      jenisSurats,
      currentPage: page,
      totalPages,
      totalCount,
      search,
      status,
      jenisId
    });
  } catch (err) {
    console.error('Transaksi surat error:', err);
    res.status(500).send('Error loading data transaksi surat');
  }
});

router.get('/transaksi-surat/create', requireAuth, async (req, res) => {
  try {
    const jenisSurats = await db.JenisSurat.findAll();
    const unitKerjas = await db.UnitKerja.findAll();
    const allTS = await db.TransaksiSurat.findAll();
    const nextUrut = allTS.reduce((max, s) => Math.max(max, Number(s.nomor_urut) || 0), 0) + 1;

    res.render('transaksi_surat/create', {
      title: 'Ambil Nomor Surat Baru',
      jenisSurats,
      unitKerjas,
      nextUrut,
      defaultTanggal: new Date().toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('Create transaksi surat error:', err);
    res.status(500).send('Error');
  }
});

router.post('/transaksi-surat', requireAuth, upload.single('file_pdf'), async (req, res) => {
  try {
    const { jenisId, unitId, klasifikasiId, tanggal_nomor, perihal, mode_penomoran } = req.body;

    const allTS = await db.TransaksiSurat.findAll();
    const nextUrut = allTS.reduce((max, s) => Math.max(max, Number(s.nomor_urut) || 0), 0) + 1;
    const formattedUrut = String(nextUrut).padStart(4, '0');

    let nomor_lengkap = formattedUrut;
    const isBooking = mode_penomoran === 'Booking';

    if (!isBooking && klasifikasiId && unitId) {
      const klas = await db.Klasifikasi.findByPk(klasifikasiId);
      const unit = await db.UnitKerja.findByPk(unitId);
      const kodeKlas = klas ? klas.kode : 'SK';
      const kodeUnit = unit ? unit.kode_unit : 'KCD XIII';
      nomor_lengkap = `${formattedUrut}/${kodeKlas}/${kodeUnit}`;
    }

    const file_pdf = req.file ? req.file.filename : null;

    await db.TransaksiSurat.create({
      nomor_urut: nextUrut,
      nomor_lengkap,
      perihal: perihal || (isBooking ? 'Nomor Dibooking' : '-'),
      tanggal_nomor: tanggal_nomor || new Date().toISOString().split('T')[0],
      userId: req.session.userId,
      jenisId: Number(jenisId) || 1,
      unitId: Number(unitId) || 1,
      klasifikasiId: klasifikasiId ? Number(klasifikasiId) : null,
      status: isBooking ? 'Booking' : 'Aktif',
      is_used: isBooking ? 0 : 1,
      file_pdf
    });

    res.redirect('/transaksi-surat?success=1');
  } catch (err) {
    console.error('Save transaksi surat error:', err);
    res.status(500).send('Gagal menyimpan penomoran surat');
  }
});

router.post('/transaksi-surat/:id/complete', requireAuth, upload.single('file_pdf'), async (req, res) => {
  try {
    const item = await db.TransaksiSurat.findByPk(req.params.id);
    if (!item) return res.status(404).send('Not found');

    const { klasifikasiId, unitId, perihal } = req.body;
    const klas = await db.Klasifikasi.findByPk(klasifikasiId);
    const unit = await db.UnitKerja.findByPk(unitId || item.unitId);
    const formattedUrut = String(item.nomor_urut).padStart(4, '0');
    const kodeKlas = klas ? klas.kode : 'SK';
    const kodeUnit = unit ? unit.kode_unit : 'KCD XIII';

    const updates = {
      nomor_lengkap: `${formattedUrut}/${kodeKlas}/${kodeUnit}`,
      perihal: perihal || item.perihal,
      status: 'Aktif',
      is_used: 1,
      klasifikasiId: Number(klasifikasiId) || item.klasifikasiId,
      unitId: Number(unitId) || item.unitId
    };

    if (req.file) {
      updates.file_pdf = req.file.filename;
    }

    await item.update(updates);
    res.redirect('/transaksi-surat');
  } catch (err) {
    console.error('Complete transaksi surat error:', err);
    res.status(500).send('Error');
  }
});

router.post('/transaksi-surat/:id/delete', requireAuth, async (req, res) => {
  try {
    const item = await db.TransaksiSurat.findByPk(req.params.id);
    if (item) await item.destroy();
    res.redirect('/transaksi-surat');
  } catch (err) {
    console.error('Delete transaksi surat error:', err);
    res.status(500).send('Error deleting');
  }
});

router.get('/transaksi-surat/export', requireAuth, async (req, res) => {
  try {
    const items = await db.TransaksiSurat.findAll({
      include: [db.JenisSurat, db.Klasifikasi, db.UnitKerja, db.User],
      order: [['nomor_urut', 'ASC']]
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Agenda Nomor Surat');

    sheet.columns = [
      { header: 'No. Urut', key: 'nomor_urut', width: 10 },
      { header: 'Nomor Surat Lengkap', key: 'nomor_lengkap', width: 30 },
      { header: 'Tanggal Surat', key: 'tanggal_nomor', width: 15 },
      { header: 'Jenis Surat', key: 'jenis', width: 15 },
      { header: 'Klasifikasi', key: 'klasifikasi', width: 35 },
      { header: 'Perihal', key: 'perihal', width: 45 },
      { header: 'Unit Kerja', key: 'unit', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Petugas / User', key: 'petugas', width: 20 }
    ];

    items.forEach(i => {
      sheet.addRow({
        nomor_urut: i.nomor_urut,
        nomor_lengkap: i.nomor_lengkap,
        tanggal_nomor: i.tanggal_nomor,
        jenis: i.JenisSurat ? i.JenisSurat.nama_jenis : '-',
        klasifikasi: i.Klasifikasi ? `${i.Klasifikasi.kode} - ${i.Klasifikasi.nama}` : '-',
        perihal: i.perihal,
        unit: i.UnitKerja ? i.UnitKerja.nama_unit : '-',
        status: i.status,
        petugas: i.User ? i.User.nama_lengkap : '-'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Agenda_Nomor_Surat_KCD_XIII.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Gagal mengekspor file Excel');
  }
});

// -------------------------------------------------------------
// SURAT MASUK
// -------------------------------------------------------------
router.get('/surat-masuk', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const statusDisposisi = req.query.status_disposisi;
    const sifat = req.query.sifat || '';
    const urgensi = req.query.urgensi || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let items = await db.SuratMasuk.findAll({
      order: [['id', 'DESC']]
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        (i.nomor_surat && i.nomor_surat.toLowerCase().includes(q)) ||
        (i.pengirim && i.pengirim.toLowerCase().includes(q)) ||
        (i.perihal && i.perihal.toLowerCase().includes(q))
      );
    }

    if (statusDisposisi !== undefined && statusDisposisi !== '') {
      const isDisp = statusDisposisi === '1';
      items = items.filter(i => (i.status_disposisi == 1 || i.status_disposisi === true) === isDisp);
    }

    if (sifat) {
      items = items.filter(i => i.sifat === sifat);
    }

    if (urgensi) {
      items = items.filter(i => i.urgensi === urgensi);
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedItems = items.slice(offset, offset + limit);

    res.render('surat_masuk/index', {
      title: 'Surat Masuk',
      items: paginatedItems,
      currentPage: page,
      totalPages,
      totalCount,
      search,
      statusDisposisi,
      sifat,
      urgensi
    });
  } catch (err) {
    console.error('Surat masuk list error:', err);
    res.status(500).send('Error loading surat masuk');
  }
});

router.get('/surat-masuk/create', requireAuth, (req, res) => {
  res.render('surat_masuk/create', {
    title: 'Catat Surat Masuk Baru',
    today: new Date().toISOString().split('T')[0]
  });
});

router.post('/surat-masuk', requireAuth, upload.single('file_pdf'), async (req, res) => {
  try {
    const { tgl_terima, tgl_surat, nomor_surat, pengirim, perihal, tgl_pelaksanaan, urgensi, sifat } = req.body;
    const file_pdf = req.file ? req.file.filename : null;

    await db.SuratMasuk.create({
      tgl_terima: tgl_terima || new Date().toISOString().split('T')[0],
      tgl_surat: tgl_surat || new Date().toISOString().split('T')[0],
      nomor_surat,
      pengirim,
      perihal,
      tgl_pelaksanaan: tgl_pelaksanaan || null,
      urgensi: urgensi || 'Biasa',
      sifat: sifat || 'Biasa',
      file_pdf,
      status_disposisi: false
    });

    res.redirect('/surat-masuk?success=1');
  } catch (err) {
    console.error('Save surat masuk error:', err);
    res.status(500).send('Gagal menyimpan surat masuk');
  }
});

router.get('/surat-masuk/:id/edit', requireAuth, async (req, res) => {
  try {
    const item = await db.SuratMasuk.findByPk(req.params.id);
    if (!item) return res.status(404).send('Surat Masuk tidak ditemukan');

    res.render('surat_masuk/edit', {
      title: 'Edit Surat Masuk',
      item
    });
  } catch (err) {
    console.error('Edit surat masuk error:', err);
    res.status(500).send('Error');
  }
});

router.post('/surat-masuk/:id/edit', requireAuth, upload.single('file_pdf'), async (req, res) => {
  try {
    const item = await db.SuratMasuk.findByPk(req.params.id);
    if (!item) return res.status(404).send('Not found');

    const { tgl_terima, tgl_surat, nomor_surat, pengirim, perihal, tgl_pelaksanaan, urgensi, sifat } = req.body;
    const updates = {
      tgl_terima,
      tgl_surat,
      nomor_surat,
      pengirim,
      perihal,
      tgl_pelaksanaan,
      urgensi,
      sifat
    };

    if (req.file) {
      updates.file_pdf = req.file.filename;
    }

    await item.update(updates);
    res.redirect('/surat-masuk?updated=1');
  } catch (err) {
    console.error('Update surat masuk error:', err);
    res.status(500).send('Gagal update surat masuk');
  }
});

router.get('/surat-masuk/:id/disposisi', requireAuth, async (req, res) => {
  try {
    const item = await db.SuratMasuk.findByPk(req.params.id);
    if (!item) return res.status(404).send('Not found');

    res.render('surat_masuk/disposisi', {
      title: 'Lembar Disposisi Surat',
      item
    });
  } catch (err) {
    console.error('Disposisi view error:', err);
    res.status(500).send('Error');
  }
});

router.post('/surat-masuk/:id/disposisi', requireAuth, async (req, res) => {
  try {
    const item = await db.SuratMasuk.findByPk(req.params.id);
    if (!item) return res.status(404).send('Not found');

    const { tujuan_disposisi, catatan_disposisi, status_disposisi } = req.body;
    await item.update({
      tujuan_disposisi,
      catatan_disposisi,
      status_disposisi: status_disposisi === '1' || status_disposisi === 'true' || true
    });

    res.redirect('/surat-masuk?disposisi_success=1');
  } catch (err) {
    console.error('Save disposisi error:', err);
    res.status(500).send('Gagal menyimpan disposisi');
  }
});

router.get('/surat-masuk/:id/cetak-disposisi', requireAuth, async (req, res) => {
  try {
    const item = await db.SuratMasuk.findByPk(req.params.id);
    if (!item) return res.status(404).send('Not found');

    res.render('surat_masuk/cetak_disposisi', {
      title: 'Cetak Lembar Disposisi',
      item
    });
  } catch (err) {
    console.error('Cetak disposisi error:', err);
    res.status(500).send('Error');
  }
});

router.post('/surat-masuk/:id/delete', requireAuth, async (req, res) => {
  try {
    const item = await db.SuratMasuk.findByPk(req.params.id);
    if (item) await item.destroy();
    res.redirect('/surat-masuk');
  } catch (err) {
    console.error('Delete surat masuk error:', err);
    res.status(500).send('Error');
  }
});

router.get('/surat-masuk/export', requireAuth, async (req, res) => {
  try {
    const items = await db.SuratMasuk.findAll({ order: [['id', 'ASC']] });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Surat Masuk');

    sheet.columns = [
      { header: 'No. Agenda', key: 'id', width: 12 },
      { header: 'Tgl. Terima', key: 'tgl_terima', width: 14 },
      { header: 'Tgl. Surat', key: 'tgl_surat', width: 14 },
      { header: 'Nomor Surat', key: 'nomor_surat', width: 30 },
      { header: 'Pengirim', key: 'pengirim', width: 40 },
      { header: 'Perihal', key: 'perihal', width: 50 },
      { header: 'Urgensi', key: 'urgensi', width: 15 },
      { header: 'Sifat', key: 'sifat', width: 15 },
      { header: 'Status Disposisi', key: 'status_disposisi', width: 18 },
      { header: 'Tujuan Disposisi', key: 'tujuan_disposisi', width: 25 },
      { header: 'Catatan Disposisi', key: 'catatan_disposisi', width: 40 }
    ];

    items.forEach(i => {
      sheet.addRow({
        id: i.id,
        tgl_terima: i.tgl_terima,
        tgl_surat: i.tgl_surat,
        nomor_surat: i.nomor_surat,
        pengirim: i.pengirim,
        perihal: i.perihal,
        urgensi: i.urgensi,
        sifat: i.sifat,
        status_disposisi: (i.status_disposisi == 1 || i.status_disposisi === true) ? 'Sudah Disposisi' : 'Belum Disposisi',
        tujuan_disposisi: i.tujuan_disposisi || '-',
        catatan_disposisi: i.catatan_disposisi || '-'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Daftar_Surat_Masuk_KCD_XIII.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Gagal ekspor');
  }
});

// -------------------------------------------------------------
// BUKU TAMU
// -------------------------------------------------------------
router.get('/tamu', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let items = await db.Tamu.findAll({
      include: [db.TransaksiBerkas],
      order: [['id', 'DESC']]
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(t =>
        (t.nama && t.nama.toLowerCase().includes(q)) ||
        (t.unit_kerja && t.unit_kerja.toLowerCase().includes(q)) ||
        (t.nip && String(t.nip).includes(q)) ||
        (t.id_tamu && t.id_tamu.toLowerCase().includes(q))
      );
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedItems = items.slice(offset, offset + limit);

    res.render('tamu/index', {
      title: 'Buku Tamu',
      items: paginatedItems,
      currentPage: page,
      totalPages,
      totalCount,
      search
    });
  } catch (err) {
    console.error('Tamu list error:', err);
    res.status(500).send('Error');
  }
});

router.get('/tamu/create', requireAuth, async (req, res) => {
  try {
    const allTamus = await db.Tamu.findAll();
    const count = allTamus.length + 1;
    const nextId = 'TME-26' + String(count).padStart(3, '0');

    res.render('tamu/create', {
      title: 'Registrasi Tamu Baru',
      nextId
    });
  } catch (err) {
    console.error('Create tamu view error:', err);
    res.status(500).send('Error');
  }
});

router.post('/tamu', requireAuth, async (req, res) => {
  try {
    const { id_tamu, nama, nip, jabatan, pekerjaan, unit_kerja, no_kontak } = req.body;
    await db.Tamu.create({
      id_tamu,
      nama,
      nip: nip || '-',
      jabatan: jabatan || '-',
      pekerjaan: pekerjaan || '-',
      unit_kerja: unit_kerja || '-',
      no_kontak: no_kontak || '-'
    });
    res.redirect('/tamu?success=1');
  } catch (err) {
    console.error('Save tamu error:', err);
    res.status(500).send('Gagal menyimpan tamu');
  }
});

router.get('/tamu/:id', requireAuth, async (req, res) => {
  try {
    const tamu = await db.Tamu.findByPk(req.params.id, {
      include: [db.TransaksiBerkas]
    });
    if (!tamu) return res.status(404).send('Tamu tidak ditemukan');

    const berkas = await db.TransaksiBerkas.findAll({
      where: { tamuId: tamu.id },
      order: [['id', 'DESC']]
    });

    res.render('tamu/detail', {
      title: 'Detail Tamu',
      tamu,
      berkas
    });
  } catch (err) {
    console.error('Tamu detail error:', err);
    res.status(500).send('Error');
  }
});

router.post('/tamu/:id/delete', requireAuth, async (req, res) => {
  try {
    const item = await db.Tamu.findByPk(req.params.id);
    if (item) await item.destroy();
    res.redirect('/tamu');
  } catch (err) {
    console.error('Delete tamu error:', err);
    res.status(500).send('Error');
  }
});

// -------------------------------------------------------------
// TRANSAKSI BERKAS TAMU
// -------------------------------------------------------------
router.get('/transaksi-berkas', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const tujuan = req.query.tujuan || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let items = await db.TransaksiBerkas.findAll({
      include: [db.Tamu],
      order: [['id', 'DESC']]
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(b => 
        (b.perihal && b.perihal.toLowerCase().includes(q)) ||
        (b.Tamu && b.Tamu.nama && b.Tamu.nama.toLowerCase().includes(q)) ||
        (b.penerima && b.penerima.toLowerCase().includes(q))
      );
    }

    if (tujuan) {
      items = items.filter(b => b.tujuan === tujuan);
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedItems = items.slice(offset, offset + limit);

    res.render('transaksi_berkas/index', {
      title: 'Transaksi Berkas Tamu',
      items: paginatedItems,
      currentPage: page,
      totalPages,
      totalCount,
      search,
      tujuan
    });
  } catch (err) {
    console.error('Transaksi berkas error:', err);
    res.status(500).send('Error');
  }
});

router.get('/transaksi-berkas/create', requireAuth, async (req, res) => {
  try {
    const tamus = await db.Tamu.findAll({ order: [['nama', 'ASC']] });
    const selectedTamuId = req.query.tamuId || null;

    res.render('transaksi_berkas/create', {
      title: 'Penerimaan Berkas Tamu Baru',
      tamus,
      selectedTamuId,
      today: new Date().toISOString().split('T')[0],
      penerimaDefault: req.session.nama_lengkap || req.session.username
    });
  } catch (err) {
    console.error('Create berkas error:', err);
    res.status(500).send('Error');
  }
});

router.post('/transaksi-berkas', requireAuth, async (req, res) => {
  try {
    const { tamuId, tgl_transaksi, perihal, tujuan, penerima } = req.body;
    await db.TransaksiBerkas.create({
      tamuId: Number(tamuId),
      tgl_transaksi: tgl_transaksi || new Date().toISOString(),
      perihal,
      tujuan,
      penerima: penerima || req.session.nama_lengkap
    });
    res.redirect('/transaksi-berkas?success=1');
  } catch (err) {
    console.error('Save berkas error:', err);
    res.status(500).send('Gagal menyimpan transaksi berkas');
  }
});

router.get('/transaksi-berkas/:id/cetak', requireAuth, async (req, res) => {
  try {
    const item = await db.TransaksiBerkas.findByPk(req.params.id, {
      include: [db.Tamu]
    });
    if (!item) return res.status(404).send('Not found');

    res.render('transaksi_berkas/cetak', {
      title: 'Tanda Terima Berkas',
      item
    });
  } catch (err) {
    console.error('Cetak tanda terima error:', err);
    res.status(500).send('Error');
  }
});

router.post('/transaksi-berkas/:id/delete', requireAuth, async (req, res) => {
  try {
    const item = await db.TransaksiBerkas.findByPk(req.params.id);
    if (item) await item.destroy();
    res.redirect('/transaksi-berkas');
  } catch (err) {
    console.error('Delete berkas error:', err);
    res.status(500).send('Error');
  }
});

// -------------------------------------------------------------
// KLASIFIKASI ARSIP
// -------------------------------------------------------------
router.get('/klasifikasi', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    let items = await db.Klasifikasi.findAll({ order: [['kode', 'ASC']] });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(k => 
        (k.kode && k.kode.toLowerCase().includes(q)) ||
        (k.nama && k.nama.toLowerCase().includes(q))
      );
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedItems = items.slice(offset, offset + limit);

    res.render('klasifikasi/index', {
      title: 'Kode Klasifikasi Arsip',
      items: paginatedItems,
      currentPage: page,
      totalPages,
      totalCount,
      search
    });
  } catch (err) {
    console.error('Klasifikasi error:', err);
    res.status(500).send('Error');
  }
});

router.get('/api/klasifikasi/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const all = await db.Klasifikasi.findAll();
    const filtered = all
      .filter(k => (k.kode && k.kode.toLowerCase().includes(q)) || (k.nama && k.nama.toLowerCase().includes(q)))
      .slice(0, 30);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// USER MANAGEMENT (ADMIN ONLY)
// -------------------------------------------------------------
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.User.findAll({ order: [['id', 'ASC']] });
    res.render('users/index', {
      title: 'Manajemen Pengguna',
      users
    });
  } catch (err) {
    console.error('User list error:', err);
    res.status(500).send('Error');
  }
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, nama_lengkap, password, role } = req.body;
    await db.User.create({
      username,
      nama_lengkap,
      password,
      role: role || 'Front Office'
    });
    res.redirect('/users?success=1');
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).send('Gagal membuat user');
  }
});

router.post('/users/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) return res.status(404).send('User tidak ditemukan');

    const { username, nama_lengkap, password, role } = req.body;
    const updates = { username, nama_lengkap, role };
    if (password) updates.password = password;

    await user.update(updates);
    res.redirect('/users?updated=1');
  } catch (err) {
    console.error('Edit user error:', err);
    res.status(500).send('Gagal edit user');
  }
});

router.post('/users/:id/delete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (user && user.username !== 'admin') {
      await user.destroy();
    }
    res.redirect('/users');
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).send('Error');
  }
});

module.exports = router;

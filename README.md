# Ospek Kit — Pre-Order Perlengkapan Ospek Unpad Jatinangor

Website pre-order kit ospek (Prabu / Fakultas / Jurusan) + barang satuan.
Pengunjung bisa cari barang, request barang yang belum ada, checkout & bayar QRIS (dummy).
Panitia atur semuanya lewat panel `/admin`.

## Struktur file
```
ospek-kit/
├── app.py                 # Backend Flask + SQLite + REST API
├── requirements.txt
├── preview.html           # PREVIEW toko 1-file (jalan tanpa server, tinggal dobel-klik)
├── preview-admin.html     # PREVIEW panel admin — HALAMAN TERPISAH (tidak dilink dari toko)
├── templates/
│   ├── index.html         # Halaman toko
│   └── admin.html         # Panel admin
└── static/
    ├── css/style.css      # Style toko + komponen
    ├── css/admin.css      # Style panel admin
    ├── js/app.js          # Logic toko
    ├── js/admin.js        # Logic admin
    └── img/qr-dummy.svg   # QR dummy cadangan
```

## Cara jalanin (versi lengkap)
```bash
pip install -r requirements.txt
python app.py
```
Buka http://127.0.0.1:5000  ·  Admin: http://127.0.0.1:5000/admin

**Password admin:** `dewaganteng123`  (ganti di `app.py` → `ADMIN_PASSWORD`)

> Panel admin **terpisah** dari toko dan **tidak** ditautkan di halaman utama — akses langsung via URL `/admin`. Di preview, buka `preview-admin.html`. Tambah produk baru ada di tab **Produk & Stok → Tambah Produk**.

Database `ospek.db` dibuat otomatis + terisi data contoh saat pertama run.

## Fitur
- Katalog + filter kategori (Prabu / Fakultas / Jurusan / Satuan) + search live
- Detail produk: varian/warna, upload design (nametag & name bag), qty
- Keranjang + checkout + QRIS dummy (QR beda tiap order; ganti QRIS asli nanti)
- Form request barang (upload design opsional)
- Contact Us (WhatsApp, email, IG, contact person) — semua dari admin
- Panel /admin: dashboard, CRUD produk + stok, request masuk (ubah status), pesanan (ubah status), ubah tampilan/banner/kontak

## Ganti QRIS asli nanti
Sekarang QR di-generate dummy (`makeQrSvg` di `app.js` & di halaman bayar).
Buat QRIS asli, integrasikan payment gateway (Midtrans/Xendit) atau tempel gambar QRIS statis kamu di halaman pembayaran.
# po-kitz-sejati

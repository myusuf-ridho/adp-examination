# ADP Quiz - Deploy ke Vercel

Aplikasi kuis interaktif untuk latihan soal ADP (Associate Data Practitioner).

## 📁 Struktur File

```
adp-examination/
├── index.html         # File HTML utama
├── styles.css         # File CSS
├── app.js            # File JavaScript utama
├── soal-data.js      # Data soal (base64 encoded PDF)
├── vercel.json       # Konfigurasi Vercel
├── Data-Soal-1.pdf   # File PDF soal (opsional)
├── Data-Soal-2.pdf   # File PDF soal (opsional)
└── README-Deploy.md  # Panduan ini
```

## 🚀 Cara Deploy ke Vercel

### Opsi 1: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI** (jika belum):
   ```bash
   npm install -g vercel
   ```

2. **Login ke Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy dari folder ini**:
   ```bash
   vercel
   ```
   
4. **Deploy ke production**:
   ```bash
   vercel --prod
   ```

### Opsi 2: Deploy via Vercel Web Dashboard

1. **Buka** [vercel.com](https://vercel.com)

2. **Login** dengan GitHub/GitLab/Bitbucket

3. **Pilih "Add New Project"**

4. **Import repository** atau **upload folder** ini

5. **Konfigurasi** (biasanya otomatis terdeteksi):
   - Framework Preset: **Other**
   - Build Command: *kosongkan*
   - Output Directory: *kosongkan* (atau `.`)
   - Install Command: *kosongkan*

6. **Click "Deploy"**

### Opsi 3: Deploy dari GitHub

1. **Push repository** ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/repo-name.git
   git push -u origin main
   ```

2. **Import di Vercel**:
   - Buka [vercel.com](https://vercel.com)
   - Klik "Add New Project"
   - Pilih repository GitHub Anda
   - Klik "Deploy"

## 🌐 Setelah Deploy

Vercel akan memberikan URL seperti:
- `https://nama-project.vercel.app`
- atau domain custom jika Anda setting

## 📝 Catatan Penting

1. **File PDF**: File `Data-Soal-1.pdf` dan `Data-Soal-2.pdf` sudah ter-encode dalam `soal-data.js`, jadi file PDF fisik tidak diperlukan untuk deployment.

2. **Update Soal**: Jika ingin menambah/update soal:
   - Upload PDF baru melalui interface web
   - Atau update file `soal-data.js` dengan encode PDF baru

3. **Local Testing**: Untuk testing lokal:
   ```bash
   # Gunakan simple http server
   npx serve
   # atau
   python -m http.server 8000
   ```
   Kemudian buka `http://localhost:8000` atau `http://localhost:3000`

4. **Custom Domain**: Untuk menambahkan custom domain, buka Project Settings di Vercel Dashboard.

## 🔧 Troubleshooting

### Masalah: Halaman blank/kosong
- Pastikan semua file (index.html, styles.css, app.js, soal-data.js) sudah ter-upload
- Check browser console untuk error
- Pastikan path file benar (relative path)

### Masalah: PDF tidak terbaca
- Pastikan file `soal-data.js` ada dan ter-load
- Check network tab di browser developer tools

### Masalah: Build error di Vercel
- Vercel tidak perlu build untuk static site
- Pastikan `vercel.json` ada dan benar
- Kosongkan Build Command di Project Settings

## 📱 Fitur Aplikasi

- ✅ Upload PDF soal manual
- ✅ Mode Ujian & Latihan
- ✅ Dark mode / Light mode
- ✅ Navigasi soal dengan filter
- ✅ Timer dan scoring
- ✅ Pembahasan lengkap
- ✅ Responsive design
- ✅ Offline-capable (setelah load pertama)

## 💡 Tips

- Gunakan Chrome/Edge untuk pengalaman terbaik
- Aplikasi ini client-side only, tidak perlu server/backend
- Data disimpan di localStorage browser (tidak akan hilang saat refresh)
- Sharing link Vercel ke peserta latihan

---

**Dibuat untuk latihan soal ADP (Associate Data Practitioner)**

Jika ada pertanyaan atau masalah, silakan buat issue atau hubungi developer.

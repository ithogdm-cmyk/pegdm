/**
 * Sistem Absensi Physical Exercise (PE) PT Global Dispomedika
 * Frontend Client Application (app.js)
 */

// Global App State
let currentTheme = 'dark';
let allEmployees = [];
let adminPasscode = '';
let currentAdminData = null;
let currentComplianceResults = null;

// API Endpoint URL configuration (saved in localStorage)
let API_URL = localStorage.getItem('GDM_PE_API_URL') || '';

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  populateISOWeekDropdown();
  
  // Check if API_URL is configured
  if (!API_URL) {
    openConfigModal();
  } else {
    loadEmployees();
  }
});

// Save API URL Config
function saveApiUrlConfig() {
  const inputUrl = document.getElementById('config-api-url').value.trim();
  if (!inputUrl) {
    showToast('Silakan masukkan URL Web App Apps Script.', 'warning');
    return;
  }
  
  API_URL = inputUrl;
  localStorage.setItem('GDM_PE_API_URL', API_URL);
  closeConfigModal();
  showToast('URL API berhasil disimpan! Menghubungkan ke server...', 'success');
  loadEmployees();
}

function openConfigModal() {
  document.getElementById('config-api-url').value = API_URL;
  document.getElementById('config-modal').style.display = 'flex';
}

function closeConfigModal() {
  document.getElementById('config-modal').style.display = 'none';
}

// Format date display on header
function initDateDisplay() {
  const dateObj = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-text').innerText = dateObj.toLocaleDateString('id-ID', options);
  
  // Default form date to today
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  document.getElementById('form-tanggal').value = `${yyyy}-${mm}-${dd}`;
}

// Fetch Active Employees for Autocomplete
async function loadEmployees() {
  if (!API_URL) return;
  
  try {
    showLoading(true, 'Memuat data karyawan...');
    const res = await fetch(`${API_URL}?action=getEmployees`);
    const data = await res.json();
    showLoading(false);
    
    if (data.success) {
      allEmployees = data.employees || [];
    } else {
      showToast('Gagal memuat data karyawan: ' + data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Gagal terhubung ke API Apps Script. Periksa URL API Anda.', 'error');
  }
}

// Page Navigation Manager
function switchPage(pageId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  
  const targetSec = document.getElementById(`page-${pageId}`);
  if (targetSec) targetSec.classList.add('active');
  
  const navItems = { 'home': 0, 'absen': 1, 'riwayat': 2, 'admin': 3 };
  const activeIdx = navItems[pageId];
  const lis = document.querySelectorAll('.nav-list li');
  if (lis[activeIdx]) lis[activeIdx].classList.add('active');

  const titleText = document.getElementById('page-title-text');
  const subtitleText = document.getElementById('page-subtitle-text');
  
  if (pageId === 'home') {
    titleText.innerText = 'Beranda Program PE';
    subtitleText.innerText = 'PT Global Dispomedika - Budaya Hidup Sehat & Bugar';
  } else if (pageId === 'absen') {
    titleText.innerText = 'Absen Olahraga Mandiri';
    subtitleText.innerText = 'Kirim laporan dan bukti aktivitas Physical Exercise Anda';
    resetForm();
  } else if (pageId === 'riwayat') {
    titleText.innerText = 'Cek Riwayat & Sanksi';
    subtitleText.innerText = 'Pantau rekapitulasi olahraga dan status kepatuhan tunjangan karyawan';
    if (adminPasscode) {
      document.getElementById('riwayat-gate').style.display = 'none';
      document.getElementById('riwayat-workspace').style.display = 'block';
    } else {
      document.getElementById('riwayat-gate').style.display = 'block';
      document.getElementById('riwayat-workspace').style.display = 'none';
    }
  } else if (pageId === 'admin') {
    titleText.innerText = 'Portal Admin HRD';
    subtitleText.innerText = 'Verifikasi absensi masuk dan kelola sanksi pemotongan tunjangan';
    if (adminPasscode) {
      document.getElementById('admin-gate').style.display = 'none';
      document.getElementById('admin-workspace').style.display = 'block';
      loadAdminDashboard();
    } else {
      document.getElementById('admin-gate').style.display = 'block';
      document.getElementById('admin-workspace').style.display = 'none';
    }
  }
}

// Toggle Dark & Light Themes
function toggleTheme() {
  const html = document.documentElement;
  const iconSpan = document.getElementById('theme-toggle-icon');
  
  if (currentTheme === 'dark') {
    html.setAttribute('data-theme', 'light');
    currentTheme = 'light';
    iconSpan.innerHTML = '🌙 Dark Mode';
  } else {
    html.setAttribute('data-theme', 'dark');
    currentTheme = 'dark';
    iconSpan.innerHTML = '☀️ Light Mode';
  }
}

// Employee Autocomplete for Absen Form
function lookupEmployee(query) {
  const badge = document.getElementById('employee-badge');
  const submitBtn = document.getElementById('submit-btn');
  const suggestionsDiv = document.getElementById('nik-suggestions');
  
  if (!query || query.trim().length === 0) {
    badge.style.display = 'none';
    submitBtn.disabled = true;
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.style.display = 'none';
    document.getElementById('validation-note-box').style.display = 'none';
    return;
  }
  
  const queryLower = query.toLowerCase().trim();
  const matches = allEmployees.filter(e => 
    e.nik.toLowerCase().includes(queryLower) || 
    e.nama.toLowerCase().includes(queryLower) || 
    e.jabatan.toLowerCase().includes(queryLower)
  );
  
  if (matches.length > 0) {
    suggestionsDiv.innerHTML = '';
    matches.slice(0, 5).forEach(emp => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `<strong>${emp.nik}</strong> - ${emp.nama} (${emp.jabatan})`;
      
      item.addEventListener('click', () => {
        document.getElementById('form-nik').value = emp.nik;
        selectEmployee(emp);
      });
      suggestionsDiv.appendChild(item);
    });
    suggestionsDiv.style.display = 'block';
  } else {
    suggestionsDiv.innerHTML = '<div class="suggestion-item" style="cursor: default; color: var(--text-muted);">Tidak ada karyawan yang cocok</div>';
    suggestionsDiv.style.display = 'block';
  }

  const found = allEmployees.find(e => e.nik.toLowerCase() === queryLower);
  if (found) {
    selectEmployee(found);
  } else {
    badge.className = 'user-lookup-badge not-found';
    badge.innerHTML = `⚠️ NIK tidak cocok dengan database aktif`;
    badge.style.display = 'flex';
    submitBtn.disabled = true;
    document.getElementById('validation-note-box').style.display = 'none';
  }
}

function selectEmployee(emp) {
  const badge = document.getElementById('employee-badge');
  const submitBtn = document.getElementById('submit-btn');
  const suggestionsDiv = document.getElementById('nik-suggestions');
  
  badge.className = 'user-lookup-badge found';
  badge.innerHTML = `👤 <strong>${emp.nama}</strong> (${emp.jabatan} | ${emp.regional} | ${emp.cabang})`;
  badge.style.display = 'flex';
  submitBtn.disabled = false;
  
  suggestionsDiv.innerHTML = '';
  suggestionsDiv.style.display = 'none';
  
  updateValidationRules(emp.cabang);
}

function lookupEmployeeSearch(query) {
  const suggestionsDiv = document.getElementById('search-nik-suggestions');
  
  if (!query || query.trim().length === 0) {
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  const queryLower = query.toLowerCase().trim();
  const matches = allEmployees.filter(e => 
    e.nik.toLowerCase().includes(queryLower) || 
    e.nama.toLowerCase().includes(queryLower) || 
    e.jabatan.toLowerCase().includes(queryLower)
  );
  
  if (matches.length > 0) {
    suggestionsDiv.innerHTML = '';
    matches.slice(0, 5).forEach(emp => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `<strong>${emp.nik}</strong> - ${emp.nama} (${emp.jabatan})`;
      
      item.addEventListener('click', () => {
        document.getElementById('search-nik').value = emp.nik;
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.style.display = 'none';
        searchHistory();
      });
      suggestionsDiv.appendChild(item);
    });
    suggestionsDiv.style.display = 'block';
  } else {
    suggestionsDiv.innerHTML = '<div class="suggestion-item" style="cursor: default; color: var(--text-muted);">Tidak ada karyawan yang cocok</div>';
    suggestionsDiv.style.display = 'block';
  }
}

// Close suggestions on outside click
document.addEventListener('click', function(e) {
  const suggestionsDiv = document.getElementById('nik-suggestions');
  const nikInput = document.getElementById('form-nik');
  if (e.target !== nikInput && e.target !== suggestionsDiv) {
    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
  }
  
  const searchSuggestionsDiv = document.getElementById('search-nik-suggestions');
  const searchInput = document.getElementById('search-nik');
  if (e.target !== searchInput && e.target !== searchSuggestionsDiv) {
    if (searchSuggestionsDiv) searchSuggestionsDiv.style.display = 'none';
  }
});

function updateValidationRules(cabang) {
  const noteBox = document.getElementById('validation-note-box');
  const isHo = cabang.toLowerCase().includes('pusat') || cabang.toLowerCase().includes('ho');
  
  noteBox.style.display = 'block';
  if (isHo) {
    noteBox.innerHTML = `ℹ️ <strong>Ketentuan Karyawan HO:</strong> Badminton di lapangan dengan foto. Untuk Pingpong, Jogging & Sepeda melampirkan foto olahraga & bukti Strava (Wajib Screenshot Strava untuk Jogging & Sepeda).`;
  } else {
    noteBox.innerHTML = `ℹ️ <strong>Ketentuan Karyawan Cabang:</strong> Melampirkan foto bukti kegiatan olahraga yang dipilih.`;
  }
  
  const currentCabor = document.getElementById('form-cabor').value;
  if (currentCabor) {
    handleCaborChange(currentCabor);
  }
}

function handleCaborChange(cabor) {
  const metaContainer = document.getElementById('cabor-meta-container');
  const metaLabel = document.getElementById('cabor-meta-label');
  const metaInput = document.getElementById('form-meta');
  
  const stravaFields = document.getElementById('strava-fields');
  const stravaScreenshotGroup = document.getElementById('strava-screenshot-group');
  
  const photoLabel = document.getElementById('main-photo-label');
  const distanceInput = document.getElementById('form-jarak');
  const durationInput = document.getElementById('form-durasi');
  const stravaProofInput = document.getElementById('form-strava-proof');

  distanceInput.required = false;
  durationInput.required = false;
  metaInput.required = false;
  
  const nik = document.getElementById('form-nik').value;
  const employee = allEmployees.find(e => e.nik.toLowerCase() === nik.trim().toLowerCase());
  const isHo = employee ? (employee.cabang.toLowerCase().includes('pusat') || employee.cabang.toLowerCase().includes('ho')) : true;

  if (cabor === 'Badminton') {
    metaContainer.style.display = 'flex';
    metaLabel.innerText = 'Nama Lapangan Badminton *';
    metaInput.placeholder = 'Contoh: Lapangan Smash GDM';
    metaInput.required = true;
    photoLabel.innerText = 'Foto Bukti Kegiatan di Lapangan Badminton *';
    
    stravaFields.style.display = 'none';
    stravaScreenshotGroup.style.display = 'none';
  } 
  else if (cabor === 'Pingpong') {
    metaContainer.style.display = 'flex';
    metaLabel.innerText = 'Nama Partner Bermain Pingpong';
    metaInput.placeholder = 'Contoh: Ahmad / Rina';
    photoLabel.innerText = 'Foto Bukti Bermain Pingpong *';
    
    stravaFields.style.display = 'none';
    stravaScreenshotGroup.style.display = 'none';
  } 
  else if (cabor === 'Jogging' || cabor === 'Bersepeda') {
    metaContainer.style.display = 'none';
    stravaFields.style.display = 'block';
    photoLabel.innerText = `Foto Bukti Kegiatan ${cabor} *`;
    
    if (isHo) {
      stravaScreenshotGroup.style.display = 'block';
      stravaProofInput.required = true;
    } else {
      stravaScreenshotGroup.style.display = 'none';
      stravaProofInput.required = false;
    }
    
    distanceInput.required = true;
    durationInput.required = true;
  } else {
    metaContainer.style.display = 'none';
    stravaFields.style.display = 'none';
    stravaScreenshotGroup.style.display = 'none';
  }
}

// Convert file to base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  const file = input.files[0];
  
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
  }
}

// Submit Attendance Form
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!API_URL) {
    showToast('URL API belum dikonfigurasi. Klik tombol ⚙️ di samping.', 'error');
    openConfigModal();
    return;
  }

  const nik = document.getElementById('form-nik').value.trim();
  const cabor = document.getElementById('form-cabor').value;
  const tanggalKegiatan = document.getElementById('form-tanggal').value;
  const meta = document.getElementById('form-meta').value;
  const jarak = document.getElementById('form-jarak').value;
  const durasi = document.getElementById('form-durasi').value;
  
  const photoFile = document.getElementById('form-photo').files[0];
  const stravaProofFile = document.getElementById('form-strava-proof').files[0];

  const employee = allEmployees.find(e => e.nik.toLowerCase() === nik.toLowerCase());
  if (!employee) {
    showToast('NIK karyawan tidak valid.', 'error');
    return;
  }

  const isHo = employee.cabang.toLowerCase().includes('pusat') || employee.cabang.toLowerCase().includes('ho');
  if (isHo && (cabor === 'Jogging' || cabor === 'Bersepeda')) {
    if (!stravaProofFile) {
      showToast('Karyawan HO wajib mengunggah Screenshot Bukti Strava.', 'error');
      return;
    }
  }

  showLoading(true, 'Mengonversi gambar & mengirim absensi...');

  try {
    const photoBase64 = await fileToBase64(photoFile);
    const stravaProofBase64 = await fileToBase64(stravaProofFile);

    let finalStravaLink = "";
    if (cabor === 'Badminton') {
      finalStravaLink = `Lokasi Lapangan: ${meta}`;
    } else if (cabor === 'Pingpong') {
      finalStravaLink = meta ? `Lawan: ${meta}` : 'Bermain Pingpong';
    }

    const payload = {
      action: 'submitAttendance',
      nik: nik,
      cabor: cabor,
      tanggalKegiatan: tanggalKegiatan,
      jarakKm: jarak,
      durasiMenit: durasi,
      stravaLink: finalStravaLink,
      photoBase64: photoBase64,
      stravaProofBase64: stravaProofBase64
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    showLoading(false);

    if (data.success) {
      showToast(data.message, 'success');
      resetForm();
    } else {
      showToast(data.message, 'error');
    }

  } catch (err) {
    showLoading(false);
    showToast('Gagal mengirim absensi: ' + err.message, 'error');
  }
}

function resetForm() {
  document.getElementById('attendance-form').reset();
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('strava-preview').style.display = 'none';
  document.getElementById('employee-badge').style.display = 'none';
  document.getElementById('cabor-meta-container').style.display = 'none';
  document.getElementById('strava-fields').style.display = 'none';
  document.getElementById('strava-screenshot-group').style.display = 'none';
  document.getElementById('validation-note-box').style.display = 'none';
  document.getElementById('submit-btn').disabled = true;
}

// Login Admin for Riwayat Page
async function loginRiwayatAdmin() {
  const passcode = document.getElementById('riwayat-passcode').value;
  if (!passcode) {
    showToast('Silakan masukkan passcode.', 'warning');
    return;
  }

  showLoading(true, 'Memverifikasi hak akses admin...');

  try {
    const res = await fetch(`${API_URL}?action=getAdminData&passcode=${encodeURIComponent(passcode)}`);
    const data = await res.json();
    showLoading(false);

    if (data.success) {
      adminPasscode = passcode;
      showToast('Verifikasi Admin Berhasil!', 'success');
      document.getElementById('riwayat-gate').style.display = 'none';
      document.getElementById('riwayat-workspace').style.display = 'block';
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Verifikasi gagal: ' + err.message, 'error');
  }
}

// Search Employee Attendance History
async function searchHistory() {
  const nik = document.getElementById('search-nik').value.trim();
  if (!nik) {
    showToast('Silakan isi NIK terlebih dahulu.', 'warning');
    return;
  }

  if (!adminPasscode) {
    showToast('Akses ditolak. Login Admin diperlukan.', 'error');
    return;
  }

  showLoading(true, 'Mengambil riwayat absensi...');

  try {
    const res = await fetch(`${API_URL}?action=getEmployeeHistory&nik=${encodeURIComponent(nik)}&passcode=${encodeURIComponent(adminPasscode)}`);
    const data = await res.json();
    showLoading(false);

    if (!data.success) {
      showToast(data.message, 'error');
      return;
    }

    const history = data.history;
    const timeline = document.getElementById('history-timeline');
    const statsContainer = document.getElementById('employee-stats-container');
    const resultsContainer = document.getElementById('history-results-container');
    const emptyDiv = document.getElementById('history-empty');
    
    timeline.innerHTML = '';
    
    if (history.length === 0) {
      statsContainer.style.display = 'none';
      resultsContainer.style.display = 'none';
      emptyDiv.style.display = 'block';
      return;
    }

    emptyDiv.style.display = 'none';
    statsContainer.style.display = 'block';
    resultsContainer.style.display = 'block';

    let approved = 0;
    let pending = 0;
    
    history.forEach(log => {
      if (log.status === 'Approved') approved++;
      if (log.status === 'Pending') pending++;
    });

    document.getElementById('emp-stat-total').innerText = history.length;
    document.getElementById('emp-stat-approved').innerText = approved;
    document.getElementById('emp-stat-pending').innerText = pending;

    history.forEach(log => {
      const item = document.createElement('div');
      item.className = `timeline-item ${log.status.toLowerCase()}`;
      
      let detailsHtml = '';
      if (log.cabor === 'Jogging' || log.cabor === 'Bersepeda') {
        detailsHtml = `
          <div class="timeline-details">
            <div class="timeline-details-item"><span>Jarak</span>${log.jarakKm} KM</div>
            <div class="timeline-details-item"><span>Durasi</span>${log.durasiMenit} Menit</div>
            <div class="timeline-details-item"><span>Tautan Strava / Bukti</span>${renderStravaLinkText(log.stravaLink)}</div>
          </div>
        `;
      } else {
        detailsHtml = `
          <div class="timeline-details">
            <div class="timeline-details-item"><span>Detail</span>${log.stravaLink || '-'}</div>
          </div>
        `;
      }

      let catHtml = log.catatanVerifikasi ? `<p style="font-size: 0.85rem; color: var(--warning); margin-top: 0.5rem;">💬 Catatan HR: ${log.catatanVerifikasi}</p>` : '';

      item.innerHTML = `
        <div class="timeline-header">
          <span class="timeline-title">${log.cabor}</span>
          <span class="status-badge ${log.status.toLowerCase()}">${log.status}</span>
        </div>
        <div class="timeline-date">📅 Tanggal Olahraga: ${log.tanggalKegiatan}</div>
        ${detailsHtml}
        ${catHtml}
      `;
      timeline.appendChild(item);
    });

  } catch (err) {
    showLoading(false);
    showToast('Gagal memuat riwayat: ' + err.message, 'error');
  }
}

function renderStravaLinkText(linkStr) {
  if (!linkStr) return '-';
  if (linkStr.startsWith('http://') || linkStr.startsWith('https://')) {
    return `<a href="${linkStr}" target="_blank" style="color: var(--accent-color);">Buka Tautan Strava ↗</a>`;
  }
  return linkStr;
}

// Login Admin Gate
async function loginAdmin() {
  const passcode = document.getElementById('admin-passcode').value;
  if (!passcode) {
    showToast('Silakan masukkan passcode.', 'warning');
    return;
  }

  showLoading(true, 'Memverifikasi hak akses admin...');

  try {
    const res = await fetch(`${API_URL}?action=getAdminData&passcode=${encodeURIComponent(passcode)}`);
    const data = await res.json();
    showLoading(false);

    if (data.success) {
      adminPasscode = passcode;
      showToast('Login Admin Berhasil!', 'success');
      document.getElementById('admin-gate').style.display = 'none';
      document.getElementById('admin-workspace').style.display = 'block';
      renderAdminDashboard(data);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Login gagal: ' + err.message, 'error');
  }
}

async function loadAdminDashboard() {
  if (!adminPasscode) return;
  showLoading(true, 'Memuat data dashboard admin...');

  try {
    const res = await fetch(`${API_URL}?action=getAdminData&passcode=${encodeURIComponent(adminPasscode)}`);
    const data = await res.json();
    showLoading(false);

    if (data.success) {
      renderAdminDashboard(data);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Gagal memuat dashboard: ' + err.message, 'error');
  }
}

function renderAdminDashboard(data) {
  currentAdminData = data;
  
  // Render Stats
  document.getElementById('admin-stat-emp').innerText = data.stats.totalEmployees;
  document.getElementById('admin-stat-pending').innerText = data.stats.pending;
  document.getElementById('admin-stat-approved').innerText = data.stats.approved;
  document.getElementById('admin-stat-penalties').innerText = data.stats.totalPenalties;
  
  renderPendingCards(data.pendingLogs);
  renderEmployeesTable(data.employees);
  renderAllLogsTable(data.allLogs);
}

function renderPendingCards(pendingLogs) {
  const container = document.getElementById('admin-pending-list');
  const emptyDiv = document.getElementById('admin-pending-empty');
  container.innerHTML = '';

  if (pendingLogs.length === 0) {
    emptyDiv.style.display = 'block';
    return;
  }
  
  emptyDiv.style.display = 'none';

  pendingLogs.forEach(log => {
    const card = document.createElement('div');
    card.className = 'pending-card';

    let photosHtml = '';
    if (log.photoUrl) {
      photosHtml += `<img src="${log.photoUrl}" class="proof-thumbnail" onclick="openImageModal('${log.photoUrl}')" alt="Foto Olahraga">`;
    }
    
    let stravaHtml = '';
    if (log.stravaLink && (log.stravaLink.includes('http://') || log.stravaLink.includes('https://'))) {
      stravaHtml = `<div class="pending-info-row"><span>Link/Bukti:</span> <a href="${log.stravaLink}" target="_blank" style="color: var(--accent-color);">Lihat Strava ↗</a></div>`;
    } else if (log.stravaLink) {
      stravaHtml = `<div class="pending-info-row"><span>Detail/Bukti:</span> ${log.stravaLink}</div>`;
    }

    card.innerHTML = `
      <div>
        <div class="pending-user">
          <div class="pending-avatar">${log.nama.charAt(0).toUpperCase()}</div>
          <div class="pending-user-info">
            <h4>${log.nama}</h4>
            <p>NIK: ${log.nik} | ${log.cabang}</p>
          </div>
        </div>

        <div class="pending-info-row"><span>Cabor:</span> <strong>${log.cabor}</strong></div>
        <div class="pending-info-row"><span>Tgl Kegiatan:</span> ${log.tanggalKegiatan}</div>
        ${log.jarakKm ? `<div class="pending-info-row"><span>Jarak / Durasi:</span> ${log.jarakKm} KM / ${log.durasiMenit} Menit</div>` : ''}
        ${stravaHtml}
        
        <div class="pending-proofs">
          ${photosHtml}
        </div>

        <div class="form-group" style="margin-top: 0.5rem; margin-bottom: 0;">
          <input type="text" id="note-${log.id}" placeholder="Catatan opsional..." style="padding: 0.5rem; font-size: 0.85rem;">
        </div>
      </div>

      <div class="pending-actions">
        <button class="btn btn-danger" onclick="processVerification('${log.id}', 'Rejected')">Tolak</button>
        <button class="btn btn-success" onclick="processVerification('${log.id}', 'Approved')">Setujui</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function processVerification(id, status) {
  const noteInput = document.getElementById(`note-${id}`);
  const notes = noteInput ? noteInput.value.trim() : '';

  showLoading(true, 'Memproses verifikasi...');

  try {
    const payload = {
      action: 'verifyAttendance',
      id: id,
      status: status,
      notes: notes,
      passcode: adminPasscode
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    showLoading(false);

    if (data.success) {
      showToast(data.message, 'success');
      loadAdminDashboard();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Gagal memverifikasi: ' + err.message, 'error');
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-sub-section').forEach(s => s.classList.remove('active'));

  document.getElementById(`tab-btn-${tabName}`).classList.add('active');
  document.getElementById(`sec-admin-${tabName}`).classList.add('active');
}

// Lightbox Modal
function openImageModal(imgUrl) {
  document.getElementById('modal-image-view').src = imgUrl;
  document.getElementById('image-modal').style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('image-modal').style.display = 'none';
}

// Render Employee Table
function renderEmployeesTable(employees) {
  const tbody = document.getElementById('admin-employees-table');
  tbody.innerHTML = '';

  employees.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${emp.nik}</strong></td>
      <td>${emp.nama}</td>
      <td>${emp.jabatan}</td>
      <td>${emp.regional || '-'}</td>
      <td><span class="status-badge ${emp.cabang.toLowerCase().includes('pusat') ? 'approved' : 'pending'}">${emp.cabang}</span></td>
      <td><span class="status-badge ${emp.status === 'Aktif' ? 'approved' : 'rejected'}">${emp.status}</span></td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="openEditEmployeeModal('${emp.nik}')">Edit</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddEmployeeModal() {
  document.getElementById('employee-modal-title').innerText = 'Tambah Karyawan Baru';
  document.getElementById('emp-nik').value = '';
  document.getElementById('emp-nik').readOnly = false;
  document.getElementById('emp-nama').value = '';
  document.getElementById('emp-jabatan').value = '';
  document.getElementById('emp-regional').value = 'Pusat';
  document.getElementById('emp-cabang').value = 'Pusat';
  document.getElementById('emp-status').value = 'Aktif';
  document.getElementById('employee-modal').style.display = 'flex';
}

function openEditEmployeeModal(nik) {
  if (!currentAdminData) return;
  const emp = currentAdminData.employees.find(e => e.nik === nik);
  if (!emp) return;

  document.getElementById('employee-modal-title').innerText = 'Edit Data Karyawan';
  document.getElementById('emp-nik').value = emp.nik;
  document.getElementById('emp-nik').readOnly = true;
  document.getElementById('emp-nama').value = emp.nama;
  document.getElementById('emp-jabatan').value = emp.jabatan;
  document.getElementById('emp-regional').value = emp.regional || 'Pusat';
  document.getElementById('emp-cabang').value = emp.cabang.toLowerCase().includes('pusat') ? 'Pusat' : 'Cabang';
  document.getElementById('emp-status').value = emp.status;
  document.getElementById('employee-modal').style.display = 'flex';
}

function closeEmployeeModal() {
  document.getElementById('employee-modal').style.display = 'none';
}

async function handleEmployeeFormSubmit(e) {
  e.preventDefault();
  
  const empData = {
    nik: document.getElementById('emp-nik').value.trim(),
    nama: document.getElementById('emp-nama').value.trim(),
    jabatan: document.getElementById('emp-jabatan').value.trim(),
    regional: document.getElementById('emp-regional').value.trim(),
    cabang: document.getElementById('emp-cabang').value,
    status: document.getElementById('emp-status').value
  };

  showLoading(true, 'Menyimpan data karyawan...');

  try {
    const payload = {
      action: 'saveEmployee',
      employeeData: empData,
      passcode: adminPasscode
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    showLoading(false);

    if (data.success) {
      showToast(data.message, 'success');
      closeEmployeeModal();
      loadAdminDashboard();
      loadEmployees();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Gagal menyimpan karyawan: ' + err.message, 'error');
  }
}

// Render All Logs Table
function renderAllLogsTable(logs) {
  const tbody = document.getElementById('admin-all-logs-table');
  tbody.innerHTML = '';

  logs.forEach(log => {
    const tr = document.createElement('tr');
    let proofHtml = log.photoUrl ? `<a href="${log.photoUrl}" target="_blank" style="color: var(--accent-color);">Lihat Foto ↗</a>` : '-';

    tr.innerHTML = `
      <td>${log.timestamp}</td>
      <td><strong>${log.nik}</strong></td>
      <td>${log.nama}</td>
      <td>${log.cabor}</td>
      <td>${log.tanggalKegiatan}</td>
      <td>${log.jarakKm ? log.jarakKm + ' KM (' + log.durasiMenit + ' min)' : log.stravaLink}</td>
      <td>${proofHtml}</td>
      <td><span class="status-badge ${log.status.toLowerCase()}">${log.status}</span></td>
      <td>${log.verifiedBy || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Populate ISO Week dropdown
function populateISOWeekDropdown() {
  const select = document.getElementById('compliance-week');
  select.innerHTML = '';
  
  const currentWeek = getISOWeekNumber(new Date());

  for (let w = 1; w <= 52; w++) {
    const option = document.createElement('option');
    option.value = w;
    option.innerText = `Minggu ke-${w} ${w === currentWeek ? '(Minggu Ini)' : ''}`;
    if (w === currentWeek) option.selected = true;
    select.appendChild(option);
  }
}

function getISOWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

// Run Weekly Compliance Check
async function runWeeklyCompliance() {
  const year = document.getElementById('compliance-year').value;
  const week = document.getElementById('compliance-week').value;

  showLoading(true, `Menghitung kepatuhan PE Minggu ke-${week} (${year})...`);

  try {
    const payload = {
      action: 'calculateWeeklyPenalties',
      year: year,
      weekNumber: week,
      passcode: adminPasscode
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    showLoading(false);

    if (data.success) {
      showToast(data.message, 'success');
      currentComplianceResults = data;
      renderComplianceResults(data);
      loadAdminDashboard();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Gagal menghitung kepatuhan: ' + err.message, 'error');
  }
}

function renderComplianceResults(data) {
  const card = document.getElementById('compliance-results-card');
  const title = document.getElementById('compliance-results-title');
  const tbody = document.getElementById('compliance-results-table');

  title.innerText = `📊 Hasil Kepatuhan PE Minggu ke-${data.week} (${data.year})`;
  tbody.innerHTML = '';
  card.style.display = 'block';

  data.results.forEach(res => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${res.nik}</strong></td>
      <td>${res.nama}</td>
      <td>${res.jabatan}</td>
      <td>${res.regional}</td>
      <td>${res.cabang}</td>
      <td>${res.approvedCount} Olahraga</td>
      <td><span class="status-badge ${res.isCompliant ? 'approved' : 'rejected'}">${res.isCompliant ? 'PATUH (Lengkap)' : 'TIDAK PATUH'}</span></td>
      <td><strong style="color: ${res.penaltyDays > 0 ? 'var(--danger)' : 'var(--success)'};">${res.penaltyDays} Hari</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

// CSV Exporters
function exportComplianceToCSV() {
  if (!currentComplianceResults) {
    showToast('Jalankan proses kepatuhan terlebih dahulu.', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Tahun,MingguKe,NIK,Nama,Jabatan,Regional,Cabang/Pusat,JumlahApprovedPE,StatusKepatuhan,PotongTunjanganHari\n";

  currentComplianceResults.results.forEach(r => {
    const row = [
      currentComplianceResults.year,
      currentComplianceResults.week,
      `"${r.nik}"`,
      `"${r.nama}"`,
      `"${r.jabatan}"`,
      `"${r.regional}"`,
      `"${r.cabang}"`,
      r.approvedCount,
      r.isCompliant ? "PATUH" : "TIDAK PATUH",
      r.penaltyDays
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Laporan_Kepatuhan_PE_W${currentComplianceResults.week}_${currentComplianceResults.year}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportAllLogsToCSV() {
  if (!currentAdminData || !currentAdminData.allLogs) {
    showToast('Data log belum dimuat.', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID,WaktuInput,NIK,Nama,Regional,Cabang/Pusat,Cabor,TglKegiatan,JarakKM,DurasiMenit,StravaLink/Detail,PhotoUrl,Status,Verificator\n";

  currentAdminData.allLogs.forEach(l => {
    const row = [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.nik}"`,
      `"${l.nama}"`,
      `"${l.regional}"`,
      `"${l.cabang}"`,
      `"${l.cabor}"`,
      `"${l.tanggalKegiatan}"`,
      l.jarakKm || 0,
      l.durasiMenit || 0,
      `"${l.stravaLink || ''}"`,
      `"${l.photoUrl || ''}"`,
      `"${l.status}"`,
      `"${l.verifiedBy || ''}"`
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Data_Absensi_PE_GlobalDispomedika_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// UI Utility: Loading Spinner & Toast
function showLoading(show, message = 'Memproses data...') {
  const overlay = document.getElementById('spinner-overlay');
  const text = document.getElementById('spinner-text');
  text.innerText = message;
  overlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

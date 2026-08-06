/**
 * Sistem Absensi Physical Exercise (PE) PT Global Dispomedika
 * Backend Google Apps Script REST API (Code.gs)
 * Berfungsi sebagai Serverless REST API untuk Frontend di Vercel
 */

// Handle HTTP GET Requests (Digunakan untuk mengambil data JSON)
function doGet(e) {
  var action = e.parameter.action;
  var response = {};

  try {
    if (action === 'getEmployees') {
      response = { success: true, employees: getEmployees() };
    } 
    else if (action === 'getAdminData') {
      var passcode = e.parameter.passcode;
      response = getAdminDashboardData(passcode);
    } 
    else if (action === 'getEmployeeHistory') {
      var nik = e.parameter.nik;
      var passcode = e.parameter.passcode;
      response = getEmployeeHistory(nik, passcode);
    } 
    else if (action === 'setupSystem') {
      response = setupSystem();
    }
    else {
      response = { success: true, message: 'PT Global Dispomedika PE Attendance API Server is Running.' };
    }
  } catch (err) {
    response = { success: false, message: 'API Error: ' + err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Handle HTTP POST Requests (Digunakan untuk mengirim/mengubah data JSON)
function doPost(e) {
  var response = {};
  
  try {
    var postData = {};
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }

    var action = postData.action;

    if (action === 'submitAttendance') {
      response = submitAttendance(postData);
    } 
    else if (action === 'verifyAttendance') {
      response = verifyAttendance(postData.id, postData.status, postData.notes, postData.passcode);
    } 
    else if (action === 'saveEmployee') {
      response = saveEmployee(postData.employeeData, postData.passcode);
    } 
    else if (action === 'calculateWeeklyPenalties') {
      response = calculateWeeklyPenalties(postData.year, postData.weekNumber, postData.passcode);
    } 
    else {
      response = { success: false, message: 'Action tidak dikenal.' };
    }
  } catch (err) {
    response = { success: false, message: 'POST Error: ' + err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper untuk mencari index header secara case-insensitive & trim whitespace
 */
function findHeaderIndex(headersArray, searchName) {
  var searchLower = searchName.toLowerCase().trim();
  for (var i = 0; i < headersArray.length; i++) {
    var val = headersArray[i].toString().toLowerCase().trim();
    if (val === searchLower) {
      return i;
    }
  }
  return -1;
}

/**
 * Inisialisasi & Migrasi Sistem (Sheets & Drive Folder)
 */
function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Tab Settings
  var settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    settingsSheet.appendRow(['Key', 'Value', 'Description']);
    settingsSheet.appendRow(['ADMIN_PASSCODE', 'GDM-PE-2026', 'Passcode untuk mengakses Dashboard Admin']);
    settingsSheet.appendRow(['COMPANY_NAME', 'PT Global Dispomedika', 'Nama Perusahaan']);
    
    var folderName = 'PT Global Dispomedika - PE Proofs';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    settingsSheet.appendRow(['DRIVE_FOLDER_ID', folder.getId(), 'ID Folder Google Drive untuk foto bukti']);
    
    settingsSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    settingsSheet.autoResizeColumns(1, 3);
  }
  
  // 2. Setup / Migrasi Tab Employees
  var employeesSheet = ss.getSheetByName('Employees');
  if (!employeesSheet) {
    employeesSheet = ss.insertSheet('Employees');
    employeesSheet.appendRow(['NIK', 'Nama', 'Jabatan', 'Regional', 'Cabang / Pusat', 'Status']);
    
    var mockEmployees = [
      ['GDM-001', 'Budi Santoso', 'IT Staff', 'Pusat', 'Pusat', 'Aktif'],
      ['GDM-002', 'Siti Aminah', 'HR Supervisor', 'Pusat', 'Pusat', 'Aktif'],
      ['GDM-003', 'Joko Widodo', 'Sales Executive', 'Jawa Tengah', 'Cabang', 'Aktif'],
      ['GDM-004', 'Rina Herawati', 'Finance Staff', 'Pusat', 'Pusat', 'Aktif'],
      ['GDM-005', 'Ahmad Dani', 'Production Lead', 'Jawa Timur', 'Cabang', 'Aktif']
    ];
    for (var i = 0; i < mockEmployees.length; i++) {
      employeesSheet.appendRow(mockEmployees[i]);
    }
    
    employeesSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    employeesSheet.autoResizeColumns(1, 6);
  } else {
    var headers = employeesSheet.getRange(1, 1, 1, employeesSheet.getLastColumn()).getValues()[0];
    
    var deptIndex = findHeaderIndex(headers, 'Departemen');
    if (deptIndex !== -1) {
      employeesSheet.getRange(1, deptIndex + 1).setValue('Jabatan');
      headers[deptIndex] = 'Jabatan';
    }
    
    var cabangIndex = findHeaderIndex(headers, 'Cabang');
    if (cabangIndex !== -1) {
      employeesSheet.getRange(1, cabangIndex + 1).setValue('Cabang / Pusat');
      headers[cabangIndex] = 'Cabang / Pusat';
    }
    
    var regionalIndex = findHeaderIndex(headers, 'Regional');
    if (regionalIndex === -1) {
      employeesSheet.insertColumnBefore(4);
      employeesSheet.getRange(1, 4).setValue('Regional');
      headers.splice(3, 0, 'Regional');
      
      var lastRow = employeesSheet.getLastRow();
      if (lastRow > 1) {
        var cabangIndexNew = findHeaderIndex(headers, 'Cabang / Pusat');
        var cabangValues = employeesSheet.getRange(2, cabangIndexNew + 1, lastRow - 1, 1).getValues();
        var regionalRange = employeesSheet.getRange(2, 4, lastRow - 1, 1);
        var regionalValues = [];
        for (var r = 0; r < cabangValues.length; r++) {
          var cabVal = cabangValues[r][0].toString().toLowerCase();
          if (cabVal.includes('pusat') || cabVal.includes('ho')) {
            regionalValues.push(['Pusat']);
          } else {
            regionalValues.push(['Cabang']);
          }
        }
        regionalRange.setValues(regionalValues);
      }
    } else {
      var lastRow = employeesSheet.getLastRow();
      if (lastRow > 1) {
        var cabangIndexNew = findHeaderIndex(headers, 'Cabang / Pusat');
        var cabangValues = employeesSheet.getRange(2, cabangIndexNew + 1, lastRow - 1, 1).getValues();
        var regionalRange = employeesSheet.getRange(2, 4, lastRow - 1, 1);
        var regionalValues = regionalRange.getValues();
        var changed = false;
        for (var r = 0; r < cabangValues.length; r++) {
          var cabVal = cabangValues[r][0].toString().toLowerCase();
          if (cabVal.includes('pusat') || cabVal.includes('ho')) {
            if (regionalValues[r][0] !== 'Pusat') {
              regionalValues[r][0] = 'Pusat';
              changed = true;
            }
          }
        }
        if (changed) {
          regionalRange.setValues(regionalValues);
        }
      }
    }
    
    employeesSheet.getRange(1, 1, 1, employeesSheet.getLastColumn()).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    employeesSheet.autoResizeColumns(1, employeesSheet.getLastColumn());
  }
  
  // 3. Setup / Migrasi Tab AttendanceLogs
  var attendanceSheet = ss.getSheetByName('AttendanceLogs');
  if (!attendanceSheet) {
    attendanceSheet = ss.insertSheet('AttendanceLogs');
    attendanceSheet.appendRow([
      'ID', 'Timestamp', 'NIK', 'Nama', 'Regional', 'Cabang / Pusat', 'Cabor', 
      'TanggalKegiatan', 'JarakKm', 'DurasiMenit', 'StravaLink', 
      'PhotoDriveUrl', 'Status', 'CatatanVerifikasi', 'VerifiedBy', 'VerifiedAt'
    ]);
    
    attendanceSheet.getRange('A1:P1').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    attendanceSheet.autoResizeColumns(1, 16);
  } else {
    var attHeaders = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn()).getValues()[0];
    
    var cIndex = findHeaderIndex(attHeaders, 'Cabang');
    if (cIndex !== -1) {
      attendanceSheet.getRange(1, cIndex + 1).setValue('Cabang / Pusat');
      attHeaders[cIndex] = 'Cabang / Pusat';
    }
    
    var rIndex = findHeaderIndex(attHeaders, 'Regional');
    if (rIndex === -1) {
      attendanceSheet.insertColumnBefore(5);
      attendanceSheet.getRange(1, 5).setValue('Regional');
      attHeaders.splice(4, 0, 'Regional');
      
      var lastRow = attendanceSheet.getLastRow();
      if (lastRow > 1) {
        var cabangIndexNew = findHeaderIndex(attHeaders, 'Cabang / Pusat');
        var cabangValues = attendanceSheet.getRange(2, cabangIndexNew + 1, lastRow - 1, 1).getValues();
        var regionalRange = attendanceSheet.getRange(2, 5, lastRow - 1, 1);
        var regionalValues = [];
        for (var r = 0; r < cabangValues.length; r++) {
          var cabVal = cabangValues[r][0].toString().toLowerCase();
          if (cabVal.includes('pusat') || cabVal.includes('ho')) {
            regionalValues.push(['Pusat']);
          } else {
            regionalValues.push(['Cabang']);
          }
        }
        regionalRange.setValues(regionalValues);
      }
    }
    
    attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn()).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    attendanceSheet.autoResizeColumns(1, attendanceSheet.getLastColumn());
  }
  
  // 4. Setup / Migrasi Tab Penalties
  var penaltiesSheet = ss.getSheetByName('Penalties');
  if (!penaltiesSheet) {
    penaltiesSheet = ss.insertSheet('Penalties');
    penaltiesSheet.appendRow([
      'Tahun', 'MingguKe', 'NIK', 'Nama', 'Jabatan', 'Regional', 'Cabang / Pusat', 
      'TunjanganDipotongHari', 'Keterangan', 'ProcessedAt'
    ]);
    
    penaltiesSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#b91c1c').setFontColor('#ffffff');
    penaltiesSheet.autoResizeColumns(1, 10);
  } else {
    var penHeaders = penaltiesSheet.getRange(1, 1, 1, penaltiesSheet.getLastColumn()).getValues()[0];
    
    var dIndex = findHeaderIndex(penHeaders, 'Departemen');
    if (dIndex !== -1) {
      penaltiesSheet.getRange(1, dIndex + 1).setValue('Jabatan');
      penHeaders[dIndex] = 'Jabatan';
    }
    
    var cIndex = findHeaderIndex(penHeaders, 'Cabang');
    if (cIndex !== -1) {
      penaltiesSheet.getRange(1, cIndex + 1).setValue('Cabang / Pusat');
      penHeaders[cIndex] = 'Cabang / Pusat';
    }
    
    var rIndex = findHeaderIndex(penHeaders, 'Regional');
    if (rIndex === -1) {
      penaltiesSheet.insertColumnBefore(6);
      penaltiesSheet.getRange(1, 6).setValue('Regional');
      penHeaders.splice(5, 0, 'Regional');
      
      var lastRow = penaltiesSheet.getLastRow();
      if (lastRow > 1) {
        var cabangIndexNew = findHeaderIndex(penHeaders, 'Cabang / Pusat');
        var cabangValues = penaltiesSheet.getRange(2, cabangIndexNew + 1, lastRow - 1, 1).getValues();
        var regionalRange = penaltiesSheet.getRange(2, 6, lastRow - 1, 1);
        var regionalValues = [];
        for (var r = 0; r < cabangValues.length; r++) {
          var cabVal = cabangValues[r][0].toString().toLowerCase();
          if (cabVal.includes('pusat') || cabVal.includes('ho')) {
            regionalValues.push(['Pusat']);
          } else {
            regionalValues.push(['Cabang']);
          }
        }
        regionalRange.setValues(regionalValues);
      }
    }
    
    penaltiesSheet.getRange(1, 1, 1, penaltiesSheet.getLastColumn()).setFontWeight('bold').setBackground('#b91c1c').setFontColor('#ffffff');
    penaltiesSheet.autoResizeColumns(1, penaltiesSheet.getLastColumn());
  }
  
  return { success: true, message: 'Sistem berhasil dimigrasi dan diinisialisasi!' };
}

function getSetting(key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Settings');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return null;
}

function validateAdminPasscode(passcode) {
  var actualPasscode = getSetting('ADMIN_PASSCODE') || 'GDM-PE-2026';
  return passcode === actualPasscode;
}

function getEmployees() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Employees');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var employees = [];
  
  for (var i = 1; i < data.length; i++) {
    var status = data[i][5];
    if (status === 'Aktif') {
      employees.push({
        nik: data[i][0].toString().trim(),
        nama: data[i][1],
        jabatan: data[i][2],
        regional: data[i][3] || '',
        cabang: data[i][4] || ''
      });
    }
  }
  return employees;
}

function uploadFileToDrive(base64Data, filename) {
  if (!base64Data) return "";
  
  var folderId = getSetting('DRIVE_FOLDER_ID');
  var folder;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = DriveApp.getRootFolder();
    }
  } else {
    folder = DriveApp.getRootFolder();
  }
  
  var splitData = base64Data.split(',');
  var contentType = 'image/jpeg';
  var base64String = base64Data;
  
  if (splitData.length > 1) {
    contentType = splitData[0].split(';')[0].split(':')[1];
    base64String = splitData[1];
  }
  
  var decoded = Utilities.base64Decode(base64String);
  var blob = Utilities.newBlob(decoded, contentType, filename);
  var file = folder.createFile(blob);
  
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
}

function submitAttendance(formData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('AttendanceLogs');
    if (!sheet) {
      setupSystem();
      sheet = ss.getSheetByName('AttendanceLogs');
    }
    
    var employees = getEmployees();
    var employee = null;
    for (var i = 0; i < employees.length; i++) {
      if (employees[i].nik.toLowerCase() === formData.nik.toLowerCase().trim()) {
        employee = employees[i];
        break;
      }
    }
    
    if (!employee) {
      return { success: false, message: 'NIK tidak terdaftar sebagai karyawan aktif PT Global Dispomedika.' };
    }
    
    var photoUrl = "";
    if (formData.photoBase64) {
      var photoName = 'PE_' + employee.nik + '_' + formData.cabor + '_' + new Date().getTime() + '.jpg';
      photoUrl = uploadFileToDrive(formData.photoBase64, photoName);
    }
    
    var stravaLink = formData.stravaLink || "";
    if (formData.stravaProofBase64) {
      var stravaFileName = 'Strava_' + employee.nik + '_' + new Date().getTime() + '.jpg';
      var stravaProofUrl = uploadFileToDrive(formData.stravaProofBase64, stravaFileName);
      if (stravaLink) {
        stravaLink = stravaLink + " | Bukti Gambar: " + stravaProofUrl;
      } else {
        stravaLink = stravaProofUrl;
      }
    }
    
    var id = 'LOG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    var now = new Date();
    
    sheet.appendRow([
      id,
      now,
      employee.nik,
      employee.nama,
      employee.regional,
      employee.cabang,
      formData.cabor,
      new Date(formData.tanggalKegiatan),
      formData.jarakKm || 0,
      formData.durasiMenit || 0,
      stravaLink,
      photoUrl,
      'Pending',
      '',
      '',
      ''
    ]);
    
    return { success: true, message: 'Absensi ' + formData.cabor + ' berhasil dikirim! Status saat ini: PENDING verifikasi HR/Admin.' };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan sistem: ' + e.toString() };
  }
}

function getEmployeeHistory(nik, passcode) {
  if (!validateAdminPasscode(passcode)) {
    return { success: false, message: 'Passcode Admin salah!' };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('AttendanceLogs');
  if (!sheet) return { success: true, history: [] };
  
  var data = sheet.getDataRange().getValues();
  var history = [];
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][2].toString().toLowerCase().trim() === nik.toLowerCase().trim()) {
      history.push({
        id: data[i][0],
        timestamp: data[i][1],
        cabor: data[i][6],
        tanggalKegiatan: Utilities.formatDate(new Date(data[i][7]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        jarakKm: data[i][8],
        durasiMenit: data[i][9],
        stravaLink: data[i][10],
        photoUrl: data[i][11],
        status: data[i][12],
        catatanVerifikasi: data[i][13],
        verifiedAt: data[i][15] ? Utilities.formatDate(new Date(data[i][15]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : ''
      });
    }
  }
  
  history.sort(function(a, b) {
    return new Date(b.tanggalKegiatan) - new Date(a.tanggalKegiatan);
  });
  
  return { success: true, history: history };
}

function getAdminDashboardData(passcode) {
  if (!validateAdminPasscode(passcode)) {
    return { success: false, message: 'Passcode Admin salah!' };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var logSheet = ss.getSheetByName('AttendanceLogs');
  var logs = [];
  var pendingLogs = [];
  
  if (logSheet) {
    var logData = logSheet.getDataRange().getValues();
    for (var i = 1; i < logData.length; i++) {
      var log = {
        id: logData[i][0],
        timestamp: Utilities.formatDate(new Date(logData[i][1]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
        nik: logData[i][2],
        nama: logData[i][3],
        regional: logData[i][4],
        cabang: logData[i][5],
        cabor: logData[i][6],
        tanggalKegiatan: Utilities.formatDate(new Date(logData[i][7]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        jarakKm: logData[i][8],
        durasiMenit: logData[i][9],
        stravaLink: logData[i][10],
        photoUrl: logData[i][11],
        status: logData[i][12],
        catatanVerifikasi: logData[i][13],
        verifiedBy: logData[i][14],
        verifiedAt: logData[i][15] ? Utilities.formatDate(new Date(logData[i][15]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : ''
      };
      
      logs.push(log);
      if (log.status === 'Pending') {
        pendingLogs.push(log);
      }
    }
  }
  
  var empSheet = ss.getSheetByName('Employees');
  var employeesList = [];
  if (empSheet) {
    var empData = empSheet.getDataRange().getValues();
    for (var j = 1; j < empData.length; j++) {
      employeesList.push({
        nik: empData[j][0],
        nama: empData[j][1],
        jabatan: empData[j][2],
        regional: empData[j][3],
        cabang: empData[j][4],
        status: empData[j][5]
      });
    }
  }
  
  var penaltySheet = ss.getSheetByName('Penalties');
  var penaltiesList = [];
  if (penaltySheet) {
    var penData = penaltySheet.getDataRange().getValues();
    for (var k = 1; k < penData.length; k++) {
      penaltiesList.push({
        tahun: penData[k][0],
        mingguKe: penData[k][1],
        nik: penData[k][2],
        nama: penData[k][3],
        jabatan: penData[k][4],
        regional: penData[k][5],
        cabang: penData[k][6],
        tunjanganDipotong: penData[k][7],
        keterangan: penData[k][8],
        processedAt: penData[k][9] ? Utilities.formatDate(new Date(penData[k][9]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : ''
      });
    }
  }
  
  pendingLogs.sort(function(a, b) {
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  
  logs.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  var stats = {
    totalEmployees: employeesList.filter(function(e) { return e.status === 'Aktif'; }).length,
    totalLogs: logs.length,
    pending: pendingLogs.length,
    approved: logs.filter(function(l) { return l.status === 'Approved'; }).length,
    rejected: logs.filter(function(l) { return l.status === 'Rejected'; }).length,
    totalPenalties: penaltiesList.length
  };
  
  return {
    success: true,
    pendingLogs: pendingLogs,
    allLogs: logs,
    employees: employeesList,
    penalties: penaltiesList,
    stats: stats
  };
}

function verifyAttendance(id, status, notes, passcode) {
  if (!validateAdminPasscode(passcode)) {
    return { success: false, message: 'Passcode Admin salah!' };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('AttendanceLogs');
  if (!sheet) return { success: false, message: 'Sheet log tidak ditemukan.' };
  
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, message: 'Log absensi tidak ditemukan.' };
  }
  
  sheet.getRange(rowIndex, 13).setValue(status);
  sheet.getRange(rowIndex, 14).setValue(notes || "");
  sheet.getRange(rowIndex, 15).setValue("Admin HR");
  sheet.getRange(rowIndex, 16).setValue(new Date());
  
  return { success: true, message: 'Absensi berhasil diverifikasi sebagai: ' + status };
}

function saveEmployee(employeeData, passcode) {
  if (!validateAdminPasscode(passcode)) {
    return { success: false, message: 'Passcode Admin salah!' };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Employees');
  if (!sheet) return { success: false, message: 'Sheet Employees tidak ditemukan.' };
  
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var targetNik = employeeData.nik.toUpperCase().trim();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase().trim() === targetNik) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 2).setValue(employeeData.nama);
    sheet.getRange(rowIndex, 3).setValue(employeeData.jabatan);
    sheet.getRange(rowIndex, 4).setValue(employeeData.regional);
    sheet.getRange(rowIndex, 5).setValue(employeeData.cabang);
    sheet.getRange(rowIndex, 6).setValue(employeeData.status);
    return { success: true, message: 'Data karyawan ' + targetNik + ' berhasil diperbarui.' };
  } else {
    sheet.appendRow([
      targetNik,
      employeeData.nama,
      employeeData.jabatan,
      employeeData.regional,
      employeeData.cabang,
      employeeData.status || 'Aktif'
    ]);
    return { success: true, message: 'Karyawan baru dengan NIK ' + targetNik + ' berhasil ditambahkan.' };
  }
}

function getISOWeek(date) {
  var d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  var yearStart = new Date(d.getFullYear(),0,1);
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function getISOWeekYear(date) {
  var d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  return d.getFullYear();
}

function calculateWeeklyPenalties(year, weekNumber, passcode) {
  if (!validateAdminPasscode(passcode)) {
    return { success: false, message: 'Passcode Admin salah!' };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var empSheet = ss.getSheetByName('Employees');
  if (!empSheet) return { success: false, message: 'Sheet karyawan tidak ditemukan.' };
  
  var empData = empSheet.getDataRange().getValues();
  var activeEmployees = [];
  for (var i = 1; i < empData.length; i++) {
    if (empData[i][5] === 'Aktif') {
      activeEmployees.push({
        nik: empData[i][0].toString().trim(),
        nama: empData[i][1],
        jabatan: empData[i][2],
        regional: empData[i][3] || '',
        cabang: empData[i][4] || ''
      });
    }
  }
  
  var logSheet = ss.getSheetByName('AttendanceLogs');
  var approvedNikList = {};
  
  if (logSheet) {
    var logData = logSheet.getDataRange().getValues();
    for (var j = 1; j < logData.length; j++) {
      var status = logData[j][12];
      var tglKegiatan = new Date(logData[j][7]);
      
      if (status === 'Approved') {
        var logYear = getISOWeekYear(tglKegiatan);
        var logWeek = getISOWeek(tglKegiatan);
        
        if (logYear === parseInt(year) && logWeek === parseInt(weekNumber)) {
          var nik = logData[j][2].toString().trim().toLowerCase();
          approvedNikList[nik] = (approvedNikList[nik] || 0) + 1;
        }
      }
    }
  }
  
  var penaltySheet = ss.getSheetByName('Penalties');
  if (!penaltySheet) {
    setupSystem();
    penaltySheet = ss.getSheetByName('Penalties');
  }
  
  var penaltyData = penaltySheet.getDataRange().getValues();
  var registeredPenalties = {};
  for (var k = 1; k < penaltyData.length; k++) {
    var pYear = parseInt(penaltyData[k][0]);
    var pWeek = parseInt(penaltyData[k][1]);
    var pNik = penaltyData[k][2].toString().trim().toLowerCase();
    registeredPenalties[pYear + '-' + pWeek + '-' + pNik] = true;
  }
  
  var penalizedCount = 0;
  var complianceResults = [];
  
  for (var e = 0; e < activeEmployees.length; e++) {
    var emp = activeEmployees[e];
    var empNikLower = emp.nik.toLowerCase();
    var isCompliant = approvedNikList[empNikLower] ? true : false;
    var approvedCount = approvedNikList[empNikLower] || 0;
    
    if (!isCompliant) {
      var penaltyKey = year + '-' + weekNumber + '-' + empNikLower;
      if (!registeredPenalties[penaltyKey]) {
        penaltySheet.appendRow([
          parseInt(year),
          parseInt(weekNumber),
          emp.nik,
          emp.nama,
          emp.jabatan,
          emp.regional,
          emp.cabang,
          1,
          'Tidak melakukan PE (Physical Exercise) pada Minggu ke-' + weekNumber + ' (' + year + ')',
          new Date()
        ]);
        penalizedCount++;
      }
    }
    
    complianceResults.push({
      nik: emp.nik,
      nama: emp.nama,
      jabatan: emp.jabatan,
      regional: emp.regional,
      cabang: emp.cabang,
      isCompliant: isCompliant,
      approvedCount: approvedCount,
      penaltyDays: isCompliant ? 0 : 1
    });
  }
  
  complianceResults.sort(function(a, b) {
    return a.isCompliant - b.isCompliant;
  });
  
  return {
    success: true,
    year: year,
    week: weekNumber,
    results: complianceResults,
    newPenaltiesAdded: penalizedCount,
    message: 'Kalkulasi selesai. Berhasil mendeteksi pelanggaran kepatuhan olahraga.'
  };
}

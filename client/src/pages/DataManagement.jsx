import React, { useState } from 'react';
import { Save, FileText, Download, Upload, Trash2, Database, RefreshCw } from 'lucide-react';

const DataManagement = () => {
  const [activeTab, setActiveTab] = useState('backup');
  const [backupName, setBackupName] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      // API call to create backup
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Backup created:', backupName);
      setBackupName('');
    } catch (error) {
      console.error('Failed to create backup:', error);
    } finally {
      setIsCreatingBackup(false);
    }
  };
  
  const handleExportData = (format) => {
    console.log(`Exporting data as ${format}`);
    // API call to export data
  };
  
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (file) {
      setIsRestoring(true);
      // API call to import data
      setTimeout(() => setIsRestoring(false), 2000);
    }
  };
  
  const handleClearData = (type) => {
    if (confirm(`Apakah Anda yakin ingin menghapus semua ${type}?`)) {
      console.log(`Clearing ${type} data`);
    }
  };
  
  const tabs = [
    { id: 'backup', label: 'Backup & Restore', icon: Save },
    { id: 'export', label: 'Export Data', icon: Download },
    { id: 'import', label: 'Import Data', icon: Upload },
    { id: 'cleanup', label: 'Cleanup', icon: Trash2 }
  ];
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <tab.icon className="inline-block w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-6">
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Buat Backup Database</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Nama backup (contoh: lex_integrity_backup_2024)"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleCreateBackup}
                  disabled={isCreatingBackup || !backupName}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingBackup ? 'Membuat...' : 'Buat Backup'}
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Backup Terjadwal</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>• Backup harian: 02:00 WIB</div>
                  <div>• Backup mingguan: Minggu 02:00 WIB</div>
                  <div>• Backup bulanan: Tanggal 1 02:00 WIB</div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'export' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Export Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleExportData('json')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Database className="h-8 w-8 text-blue-600 mb-2" />
                  <h4 className="font-medium">Export JSON</h4>
                  <p className="text-sm text-gray-600">Download semua data dalam format JSON</p>
                </button>
                
                <button
                  onClick={() => handleExportData('csv')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-8 w-8 text-green-600 mb-2" />
                  <h4 className="font-medium">Export CSV</h4>
                  <p className="text-sm text-gray-600">Download data dalam format CSV untuk analisis</p>
                </button>
                
                <button
                  onClick={() => handleExportData('pdf')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-8 w-8 text-red-600 mb-2" />
                  <h4 className="font-medium">Export PDF</h4>
                  <p className="text-sm text-gray-600">Download laporan dalam format PDF</p>
                </button>
                
                <button
                  onClick={() => handleExportData('xlsx')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-8 w-8 text-purple-600 mb-2" />
                  <h4 className="font-medium">Export Excel</h4>
                  <p className="text-sm text-gray-600">Download data dalam format Excel</p>
                </button>
              </div>
            </div>
          )}
          
          {activeTab === 'import' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Import Data</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload file backup atau data</p>
                <p className="text-sm text-gray-500 mb-4">Format yang didukung: .json, .sql, .csv</p>
                <input
                  type="file"
                  onChange={handleImportData}
                  accept=".json,.sql,.csv"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  Pilih File
                </label>
              </div>
              
              {isRestoring && (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-6 w-6 text-blue-600 animate-spin mr-2" />
                  <span>Memulihkan data...</span>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'cleanup' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cleanup Operations</h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Perhatian</h4>
                <p className="text-sm text-yellow-700">
                  Tindakan ini akan menghapus data permanen. Pastikan Anda telah membuat backup sebelum melanjutkan.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleClearData('rules without analysis')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left"
                >
                  <h4 className="font-medium text-red-800">Hapus Rules Tanpa Analisis</h4>
                  <p className="text-sm text-gray-600 mt-1">Menghapus semua peraturan yang belum dianalisis</p>
                </button>
                
                <button
                  onClick={() => handleClearData('old logs')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left"
                >
                  <h4 className="font-medium text-red-800">Hapus Log Lama</h4>
                  <p className="text-sm text-gray-600 mt-1">Menghapus log lebih dari 30 hari</p>
                </button>
                
                <button
                  onClick={() => handleClearData('temp files')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left"
                >
                  <h4 className="font-medium text-red-800">Hapus File Temp</h4>
                  <p className="text-sm text-gray-600 mt-1">Menghapus file temporary dan cache</p>
                </button>
                
                <button
                  onClick={() => handleClearData('failed jobs')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left"
                >
                  <h4 className="font-medium text-red-800">Hapus Pekerjaan Gagal</h4>
                  <p className="text-sm text-gray-600 mt-1">Membersihkan antrian pekerjaan yang gagal</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataManagement;
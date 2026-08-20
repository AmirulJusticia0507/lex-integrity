import React, { useState, useEffect } from 'react';
import { Save, FileText, Download, Upload, Trash2, Database, RefreshCw, UserPlus, CheckCircle2, AlertCircle, UserSquare, Shield, Pencil, Zap, Clock } from 'lucide-react';

const DataManagement = () => {
  const [activeTab, setActiveTab] = useState('backup');
  const [backupName, setBackupName] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isRolesLoading, setIsRolesLoading] = useState(false);

  const [userForm, setUserForm] = useState({ id: null, username: '', email: '', password: '', role: 'user' });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userResult, setUserResult] = useState(null);

  const [roleResults, setRoleResults] = useState({});

  const [rlSettings, setRlSettings] = useState({});
  const [rlLoading, setRlLoading] = useState(false);
  const [rlSaving, setRlSaving] = useState(false);
  const [rlResult, setRlResult] = useState(null);

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) setUsers(data.data);
    } catch (error) {
      console.error('Gagal memuat pengguna:', error);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const fetchRoles = async () => {
    setIsRolesLoading(true);
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      if (data.success) {
        setRoles(data.data);
        setAvailablePermissions(data.available_permissions || []);
      }
    } catch (error) {
      console.error('Gagal memuat role:', error);
    } finally {
      setIsRolesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'roles') fetchRoles();
    if (activeTab === 'ratelimit') fetchRlSettings();
  }, [activeTab]);

  const fetchRlSettings = async () => {
    setRlLoading(true);
    try {
      const response = await fetch('/api/settings/rate-limit');
      const data = await response.json();
      if (data.success) setRlSettings(data.data);
    } catch (error) {
      console.error('Gagal memuat pengaturan rate-limit:', error);
    } finally {
      setRlLoading(false);
    }
  };

  const handleRlChange = (key, field, value) => {
    setRlSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSaveRlSettings = async () => {
    setRlSaving(true);
    setRlResult(null);
    try {
      const response = await fetch('/api/settings/rate-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rlSettings),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setRlResult({ success: true, message: data.message || 'Pengaturan disimpan & diterapkan' });
        setRlSettings(data.data);
      } else {
        setRlResult({ success: false, message: data.error || 'Gagal menyimpan' });
      }
    } catch (error) {
      console.error('Gagal menyimpan rate-limit:', error);
      setRlResult({ success: false, message: 'Tidak dapat terhubung ke server' });
    } finally {
      setRlSaving(false);
    }
  };

  const resetUserForm = () => {
    setUserForm({ id: null, username: '', email: '', password: '', role: 'user' });
    setUserResult(null);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setIsSavingUser(true);
    setUserResult(null);
    try {
      const isEdit = !!userForm.id;
      const body = { username: userForm.username, email: userForm.email, role: userForm.role };
      if (!isEdit) body.password = userForm.password;
      else if (userForm.password) body.password = userForm.password;

      const response = await fetch(`/api/users${isEdit ? `/${userForm.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setUserResult({ success: true, message: data.message || (isEdit ? 'Akun diperbarui' : 'Akun berhasil dibuat') });
        resetUserForm();
        fetchUsers();
      } else {
        setUserResult({ success: false, message: data.error || 'Gagal menyimpan akun' });
      }
    } catch (error) {
      console.error('Gagal menyimpan akun:', error);
      setUserResult({ success: false, message: 'Tidak dapat terhubung ke server' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleEditUser = (user) => {
    setUserForm({ id: user.id, username: user.username, email: user.email, password: '', role: user.role });
    setUserResult(null);
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Hapus akun "${user.username}"?`)) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok && data.success) {
        setUserResult({ success: true, message: data.message || 'Akun dihapus' });
        fetchUsers();
      } else {
        setUserResult({ success: false, message: data.error || 'Gagal menghapus akun' });
      }
    } catch (error) {
      console.error('Gagal menghapus akun:', error);
      setUserResult({ success: false, message: 'Tidak dapat terhubung ke server' });
    }
  };

  const handleTogglePermission = (roleName, perm) => {
    setRoles(prev => prev.map(r => {
      if (r.name !== roleName) return r;
      const perms = r.permissions.includes(perm)
        ? r.permissions.filter(p => p !== perm)
        : [...r.permissions, perm];
      return { ...r, permissions: perms };
    }));
  };

  const handleSaveRole = async (role) => {
    setRoleResults(prev => ({ ...prev, [role.name]: null }));
    try {
      const response = await fetch(`/api/roles/${role.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: role.permissions }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setRoleResults(prev => ({ ...prev, [role.name]: { success: true, message: data.message || 'Perizinan disimpan' } }));
      } else {
        setRoleResults(prev => ({ ...prev, [role.name]: { success: false, message: data.error || 'Gagal menyimpan' } }));
      }
    } catch (error) {
      console.error('Gagal menyimpan role:', error);
      setRoleResults(prev => ({ ...prev, [role.name]: { success: false, message: 'Tidak dapat terhubung ke server' } }));
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
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
  };
  
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (file) {
      setIsRestoring(true);
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
    { id: 'cleanup', label: 'Cleanup', icon: Trash2 },
    { id: 'users', label: 'User Management', icon: UserSquare },
    { id: 'roles', label: 'Role Permissions', icon: Shield },
    { id: 'ratelimit', label: 'Rate Limiting', icon: Zap }
  ];
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
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
              <h3 className="text-lg font-semibold dark:text-gray-100">Buat Backup Database</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Nama backup (contoh: lex_integrity_backup_2024)"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <button
                  onClick={handleCreateBackup}
                  disabled={isCreatingBackup || !backupName}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingBackup ? 'Membuat...' : 'Buat Backup'}
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
                <h4 className="font-medium mb-2 dark:text-gray-100">Backup Terjadwal</h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div>• Backup harian: 02:00 WIB</div>
                  <div>• Backup mingguan: Minggu 02:00 WIB</div>
                  <div>• Backup bulanan: Tanggal 1 02:00 WIB</div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'export' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold dark:text-gray-100">Export Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleExportData('json')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <Database className="h-8 w-8 text-blue-600 mb-2" />
                  <h4 className="font-medium dark:text-gray-100">Export JSON</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Download semua data dalam format JSON</p>
                </button>
                
                <button
                  onClick={() => handleExportData('csv')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <FileText className="h-8 w-8 text-green-600 mb-2" />
                  <h4 className="font-medium dark:text-gray-100">Export CSV</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Download data dalam format CSV untuk analisis</p>
                </button>
                
                <button
                  onClick={() => handleExportData('pdf')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <FileText className="h-8 w-8 text-red-600 mb-2" />
                  <h4 className="font-medium dark:text-gray-100">Export PDF</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Download laporan dalam format PDF</p>
                </button>
                
                <button
                  onClick={() => handleExportData('xlsx')}
                  className="p-6 border rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <Download className="h-8 w-8 text-purple-600 mb-2" />
                  <h4 className="font-medium dark:text-gray-100">Export Excel</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Download data dalam format Excel</p>
                </button>
              </div>
            </div>
          )}
          
          {activeTab === 'import' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold dark:text-gray-100">Import Data</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center dark:border-gray-600">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2 dark:text-gray-300">Upload file backup atau data</p>
                <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">Format yang didukung: .json, .sql, .csv</p>
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
                <div className="flex items-center justify-center py-4 dark:text-gray-300">
                  <RefreshCw className="h-6 w-6 text-blue-600 animate-spin mr-2" />
                  <span>Memulihkan data...</span>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'cleanup' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold dark:text-gray-100">Cleanup Operations</h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-gray-700 dark:border-yellow-900">
                <h4 className="font-medium text-yellow-800 mb-2 dark:text-yellow-300">Perhatian</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Tindakan ini akan menghapus data permanen. Pastikan Anda telah membuat backup sebelum melanjutkan.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleClearData('rules without analysis')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left dark:border-gray-700 dark:hover:bg-red-900/30"
                >
                  <h4 className="font-medium text-red-800 dark:text-red-400">Hapus Rules Tanpa Analisis</h4>
                  <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">Menghapus semua peraturan yang belum dianalisis</p>
                </button>
                
                <button
                  onClick={() => handleClearData('old logs')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left dark:border-gray-700 dark:hover:bg-red-900/30"
                >
                  <h4 className="font-medium text-red-800 dark:text-red-400">Hapus Log Lama</h4>
                  <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">Menghapus log lebih dari 30 hari</p>
                </button>
                
                <button
                  onClick={() => handleClearData('temp files')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left dark:border-gray-700 dark:hover:bg-red-900/30"
                >
                  <h4 className="font-medium text-red-800 dark:text-red-400">Hapus File Temp</h4>
                  <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">Menghapus file temporary dan cache</p>
                </button>
                
                <button
                  onClick={() => handleClearData('failed jobs')}
                  className="p-4 border rounded-lg hover:bg-red-50 transition-colors text-left dark:border-gray-700 dark:hover:bg-red-900/30"
                >
                  <h4 className="font-medium text-red-800 dark:text-red-400">Hapus Pekerjaan Gagal</h4>
                  <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">Membersihkan antrian pekerjaan yang gagal</p>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold dark:text-gray-100">
                  {userForm.id ? `Edit Akun "${userForm.username}"` : 'Buat Akun Baru'}
                </h3>
                <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
                  {userForm.id
                    ? 'Perbarui informasi akun pengguna. Kosongkan password jika tidak ingin mengubahnya.'
                    : 'Tambahkan akun pengguna baru ke sistem.'}
                </p>
                <form onSubmit={handleUserSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Username</label>
                    <input
                      type="text"
                      placeholder="mis. admin"
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
                    <input
                      type="email"
                      placeholder="mis. user@contoh.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                      Password {userForm.id && <span className="text-gray-400">(opsional saat edit)</span>}
                    </label>
                    <input
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      required={!userForm.id}
                      minLength={6}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    >
                      {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                      {roles.length === 0 && <option value="user">user</option>}
                    </select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSavingUser}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      {isSavingUser ? 'Menyimpan...' : (userForm.id ? 'Simpan Perubahan' : 'Buat Akun')}
                    </button>
                    {userForm.id && (
                      <button
                        type="button"
                        onClick={resetUserForm}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </form>
                {userResult && (
                  <div className={`mt-4 flex items-start gap-2 p-3 rounded-lg text-sm ${userResult.success
                      ? 'bg-green-50 text-green-700 dark:bg-gray-700 dark:text-green-400'
                      : 'bg-red-50 text-red-700 dark:bg-gray-700 dark:text-red-400'}`}>
                    {userResult.success
                      ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    {userResult.message}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Daftar Pengguna</h3>
                {isUsersLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    Memuat pengguna...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          <th className="py-2 pr-4">Username</th>
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Role</th>
                          <th className="py-2 pr-4">Dibuat</th>
                          <th className="py-2 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-400">Belum ada pengguna.</td>
                          </tr>
                        )}
                        {users.map(user => (
                          <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{user.username}</td>
                            <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{user.email}</td>
                            <td className="py-3 pr-4">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-gray-700 dark:text-blue-300">
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                              {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleEditUser(user)}
                                className="inline-flex items-center gap-1 mr-3 text-blue-600 hover:text-blue-800 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold dark:text-gray-100">Role & Permissions</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Atur izin akses untuk setiap role. Centang permission yang diizinkan lalu simpan.
              </p>
              {isRolesLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Memuat role...
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {roles.map(role => (
                    <div key={role.id} className="border border-gray-200 rounded-lg p-5 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">{role.name}</h4>
                        <button
                          onClick={() => handleSaveRole(role)}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Save className="h-4 w-4" />
                          Simpan
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availablePermissions.map(perm => (
                          <label
                            key={perm}
                            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer dark:text-gray-300"
                          >
                            <input
                              type="checkbox"
                              checked={role.permissions.includes(perm)}
                              onChange={() => handleTogglePermission(role.name, perm)}
                              className="rounded"
                            />
                            {perm}
                          </label>
                        ))}
                      </div>
                      {roleResults[role.name] && (
                        <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg text-sm ${roleResults[role.name].success
                            ? 'bg-green-50 text-green-700 dark:bg-gray-700 dark:text-green-400'
                            : 'bg-red-50 text-red-700 dark:bg-gray-700 dark:text-red-400'}`}>
                          {roleResults[role.name].success
                            ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                          {roleResults[role.name].message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'ratelimit' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold dark:text-gray-100">Pengaturan Rate Limiting</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Atur batas permintaan per IP. Aturan disimpan & diterapkan secara real-time tanpa restart.
                  </p>
                </div>
                <button
                  onClick={handleSaveRlSettings}
                  disabled={rlSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <Save className="h-4 w-4" />
                  {rlSaving ? 'Menyimpan...' : 'Simpan & Terapkan'}
                </button>
              </div>

              {rlResult && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${rlResult.success
                    ? 'bg-green-50 text-green-700 dark:bg-gray-700 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-gray-700 dark:text-red-400'}`}>
                  {rlResult.success
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  {rlResult.message}
                </div>
              )}

              {rlLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Memuat pengaturan...
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(rlSettings).map(([key, cfg]) => (
                    <div
                      key={key}
                      className={`border rounded-lg p-5 transition-colors dark:border-gray-700 ${
                        cfg.enabled ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Zap className={`h-5 w-5 ${cfg.enabled ? 'text-blue-500' : 'text-gray-400'}`} />
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{cfg.label || key}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">/{key}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRlChange(key, 'enabled', !cfg.enabled)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            cfg.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          aria-label={`Toggle ${cfg.label || key}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            cfg.enabled ? 'translate-x-5' : ''
                          }`} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
                            <Clock className="inline h-3 w-3 mr-1" />
                            Jendela Waktu (detik)
                          </label>
                          <input
                            type="number"
                            value={Math.round((cfg.windowMs || 60000) / 1000)}
                            onChange={(e) => handleRlChange(key, 'windowMs', (parseInt(e.target.value) || 1) * 1000)}
                            min={1}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
                            <Zap className="inline h-3 w-3 mr-1" />
                            Maks Request per Jendela
                          </label>
                          <input
                            type="number"
                            value={cfg.max === -1 ? '' : cfg.max}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleRlChange(key, 'max', v === '' ? -1 : parseInt(v) || 1);
                            }}
                            placeholder="∞ (unlimited)"
                            min={-1}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                          />
                          {cfg.max === -1 && (
                            <p className="text-xs text-blue-500 mt-1">Tanpa batas (unlimited)</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
                            Rate
                          </label>
                          <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
                            {cfg.max === -1
                              ? 'Tanpa batas'
                              : `${cfg.max} req / ${Math.round((cfg.windowMs || 60000) / 1000)} detik`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataManagement;
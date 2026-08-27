import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, FileText, Globe, Loader2, File as FileIcon,
  Table, Presentation, AlertTriangle, Eye, Download
} from 'lucide-react';
import { authFetch } from '../utils/http';
import LoadingScreen from '../components/layout/LoadingScreen';

const ONLYOFFICE_URL = (process.env.REACT_APP_ONLYOFFICE_URL || '').replace(/\/$/, '');

function documentTypeFor(fileType = '') {
  const f = fileType.toLowerCase();
  if (['xls', 'xlsx', 'csv', 'ods'].includes(f)) return 'cell';
  if (['ppt', 'pptx', 'odp'].includes(f)) return 'slide';
  return 'word'; // pdf, docx, doc, odt, txt, rtf -> word processor viewer
}

function fileIconFor(fileType = '') {
  const f = fileType.toLowerCase();
  if (['xls', 'xlsx', 'csv', 'ods'].includes(f)) return Table;
  if (['ppt', 'pptx', 'odp'].includes(f)) return Presentation;
  return FileIcon;
}

function loadDocsApi(baseUrl) {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve();
    const script = document.createElement('script');
    script.src = `${baseUrl}/web-apps/apps/api/documents/api.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat OnlyOffice API'));
    document.body.appendChild(script);
  });
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const SourceViewer = () => {
  const { rule_code } = useParams();
  const navigate = useNavigate();

  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tab, setTab] = useState('page');
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(null);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [ooLoading, setOoLoading] = useState(false);
  const [ooError, setOoError] = useState(null);
  const editorRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch(`/api/rules/${encodeURIComponent(rule_code)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Peraturan tidak ditemukan');
        setRule(json.data);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [rule_code]);

  // Ambil daftar dokumen saat tab "Dokumen" dibuka pertama kali
  const loadDocuments = () => {
    if (docsData || docsLoading) return;
    setDocsLoading(true);
    setDocsError(null);
    authFetch(`/api/rules/${encodeURIComponent(rule_code)}/source-docs`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({ success: false, error: 'Respon tidak valid' }));
        if (!json.success) throw new Error(json.error || `HTTP ${r.status}`);
        setDocsData(json.data);
      })
      .catch((e) => setDocsError(e.message))
      .finally(() => setDocsLoading(false));
  };

  const switchTab = (id) => {
    setTab(id);
    if (id === 'docs') loadDocuments();
  };

  // Render dokumen terpilih (OnlyOffice atau fallback)
  useEffect(() => {
    if (!selectedDoc) return undefined;
    setOoError(null);

    if (ONLYOFFICE_URL) {
      setOoLoading(true);
      loadDocsApi(ONLYOFFICE_URL)
        .then(() => {
          const container = editorRef.current;
          if (!container) return;
          container.innerHTML = '<div id="onlyoffice-placeholder"></div>';
          const fileType = selectedDoc.fileType || 'pdf';
          window.DocsAPI.DocEditor('onlyoffice-placeholder', {
            document: {
              fileType,
              key: `lex-${simpleHash(selectedDoc.url)}`,
              title: selectedDoc.text || `dokumen.${fileType}`,
              url: selectedDoc.url
            },
            documentType: documentTypeFor(fileType),
            type: 'desktop',
            height: '100%',
            width: '100%',
            editorConfig: {
              mode: 'view',
              customization: { compactHeader: true, hideRightMenu: true, hideRulers: true }
            }
          });
        })
        .catch((e) => setOoError(e.message))
        .finally(() => setOoLoading(false));
      return () => {
        try { window.DocsAPI.DocEditor.destroyEditor?.(); } catch { /* noop */ }
      };
    }

    return undefined;
  }, [selectedDoc]);

  if (loading) return <LoadingScreen label="Memuat sumber peraturan..." />;

  if (error && !rule) {
    return (
      <div className="bg-white rounded-xl p-10 text-center dark:bg-gray-800">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/rules')} className="text-blue-600 hover:text-blue-800 font-medium">
          Kembali ke Explorer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/rules/${rule_code}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Detail Peraturan
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-snug dark:text-gray-100">{rule.title}</h1>
            <p className="text-xs text-gray-500 mt-1 font-mono break-all dark:text-gray-400">
              Sumber: {(rule.source_url || '').toString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rule.pdf_url && (
              <a
                href={rule.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-300 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20"
                title="Unduh file PDF asli peraturan"
              >
                <Download className="h-4 w-4" />
                Unduh PDF
              </a>
            )}
            <a
              href={rule.source_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Asli
            </a>
          </div>
        </div>

        {/* Tab */}
        <div className="mt-5 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'page', label: 'Halaman Sumber', icon: Globe },
            { id: 'docs', label: 'Dokumen', icon: FileText }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === 'docs' && docsData?.total > 0 && (
                <span className="ml-1 px-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold dark:bg-blue-900/40 dark:text-blue-300">
                  {docsData.total}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Konten tab */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden dark:bg-gray-800">
        {tab === 'page' && (
          <div>
            <iframe
              src={rule.source_url}
              title="Halaman Sumber"
              className="w-full bg-white"
              style={{ height: '75vh', border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
            <p className="px-4 py-2.5 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/40 dark:text-gray-500">
              Beberapa situs memblokir tampilan dalam iframe — gunakan tombol "Buka Asli" bila halaman kosong.
            </p>
          </div>
        )}

        {tab === 'docs' && (
          <div className="p-5 space-y-4">
            {docsLoading && (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memindai halaman sumber untuk dokumen...
              </p>
            )}

            {docsError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-700 text-sm dark:bg-yellow-900/20 dark:text-yellow-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {docsError}
              </div>
            )}

            {docsData && docsData.total === 0 && (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Tidak ditemukan tautan dokumen pada halaman sumber ini.
              </p>
            )}

            {docsData && docsData.documents.map((doc) => {
              const DocIcon = fileIconFor(doc.fileType);
              const isSelected = selectedDoc?.url === doc.url;
              return (
                <div key={doc.url} className="border border-gray-200 rounded-xl overflow-hidden dark:border-gray-700">
                  <div className={`flex items-center gap-3 p-3.5 ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 dark:bg-red-900/30">
                      <DocIcon className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate dark:text-gray-200">{doc.text}</p>
                      <p className="text-xs text-gray-400 truncate">.{doc.fileType} • {doc.url}</p>
                    </div>
                    <button
                      onClick={() => setSelectedDoc(isSelected ? null : doc)}
                      disabled={!!ONLYOFFICE_URL === false && !['pdf'].includes(doc.fileType.toLowerCase())}
                      title={
                        ONLYOFFICE_URL
                          ? 'Buka di OnlyOffice Viewer'
                          : ['pdf'].includes(doc.fileType.toLowerCase())
                            ? 'Pratinjau PDF'
                            : 'Butuh konfigurasi REACT_APP_ONLYOFFICE_URL untuk format non-PDF'
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shrink-0 dark:disabled:bg-gray-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Lihat
                    </button>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Unduh / buka di tab baru"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors dark:hover:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {/* Panel viewer */}
                  {isSelected && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      {ONLYOFFICE_URL ? (
                        <>
                          {ooLoading && (
                            <p className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Menyiapkan OnlyOffice Viewer...
                            </p>
                          )}
                          {ooError && (
                            <p className="p-3 m-3 rounded-lg bg-red-50 text-red-600 text-sm dark:bg-red-900/20 dark:text-red-300">
                              {ooError}
                            </p>
                          )}
                          <div ref={editorRef} style={{ height: '70vh' }} className={ooLoading ? 'hidden' : ''} />
                        </>
                      ) : doc.fileType.toLowerCase() === 'pdf' ? (
                        <div>
                          <iframe src={doc.url} title={doc.text} className="w-full bg-gray-100" style={{ height: '70vh', border: 'none' }} />
                          <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/40 dark:text-gray-500">
                            Pratinjau PDF bawaan browser. Setel REACT_APP_ONLYOFFICE_URL untuk viewer OnlyOffice.
                          </p>
                        </div>
                      ) : (
                        <p className="p-3 m-3 rounded-lg bg-yellow-50 text-yellow-700 text-sm dark:bg-yellow-900/20 dark:text-yellow-300">
                          Format .{doc.fileType} memerlukan OnlyOffice Document Server. Setel variabel lingkungan{' '}
                          <code className="font-mono">REACT_APP_ONLYOFFICE_URL</code>, lalu gunakan "Buka di tab baru".
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceViewer;

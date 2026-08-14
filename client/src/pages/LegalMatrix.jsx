import React, { useState, useEffect } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { BarChart, LineChart } from '../components/charts';
import { useRuleStore } from '../store/rules';

const LegalMatrix = () => {
  const [selectedRegime, setSelectedRegime] = useState('all');
  const [matrixData, setMatrixData] = useState(null);
  const { regimes, fetchRegimes, analyzeConflicts } = useRuleStore();
  
  useEffect(() => {
    fetchRegimes();
    handleRegimeChange('all');
  }, []);
  
  const handleRegimeChange = async (regime) => {
    setSelectedRegime(regime);
    try {
      const conflicts = await analyzeConflicts(regime);
      setMatrixData(conflicts);
    } catch (e) {
      console.error('Gagal load matrix:', e.message);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Analisis Konflik Hukum</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleRegimeChange('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${selectedRegime === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Semua Era
          </button>
          {regimes?.map(regime => (
            <button
              key={regime}
              onClick={() => handleRegimeChange(regime)}
              className={`px-4 py-2 rounded-lg transition-colors ${selectedRegime === regime ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              {regime}
            </button>
          ))}
        </div>
      </div>
      
      {matrixData && (
        <div className="bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Matriks Kontradiksi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BarChart 
              data={matrixData.regime_conflicts} 
              title={`Konflik dalam Era ${selectedRegime === 'all' ? 'Semua' : selectedRegime}`} 
            />
            <LineChart 
              data={matrixData.time_series} 
              title="Tren Konflik Sepanjang Waktu" 
            />
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Laporan Celah & Risiko</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Loopholes Paling Kritis</h4>
            <ul className="space-y-2">
              {matrixData?.critical_loopholes?.slice(0, 5).map((loophole, index) => (
                <li key={index} className="flex items-start">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1 mr-2" />
                  <span className="text-sm">{loophole}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Regulasi Populer</h4>
            <ul className="space-y-2">
              {matrixData?.popular_regulations?.slice(0, 5).map((regulation, index) => (
                <li key={index} className="flex items-start">
                  <FileText className="h-4 w-4 text-blue-500 mt-1 mr-2" />
                  <span className="text-sm">{regulation.title} ({regulation.view_count} kali dilihat)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalMatrix;
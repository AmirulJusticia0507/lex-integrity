import React, { useMemo, useState } from 'react';

const RuleGraph = ({ rules = [] }) => {
  const [selectedRule, setSelectedRule] = useState(null);

  const nodes = useMemo(() => {
    return rules.map((rule, index) => ({
      id: rule.rule_code || `rule-${index}`,
      label: rule.title || rule.rule_code,
      category: rule.category,
      regime: rule.regime
    }));
  }, [rules]);

  const getCategoryColor = (category) => {
    const colors = {
      'UU': 'bg-blue-100 border-blue-300 text-blue-800',
      'PP': 'bg-green-100 border-green-300 text-green-800',
      'Perpres': 'bg-purple-100 border-purple-300 text-purple-800',
      'Perda': 'bg-orange-100 border-orange-300 text-orange-800',
      'Permen': 'bg-red-100 border-red-300 text-red-800'
    };
    return colors[category] || 'bg-gray-100 border-gray-300 text-gray-800';
  };

  const selectedNode = nodes.find(n => n.id === selectedRule);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-wrap gap-3 p-4 border rounded-lg min-h-[200px]">
        {nodes.length === 0 && (
          <p className="text-gray-500">Tidak ada peraturan untuk ditampilkan</p>
        )}
        {nodes.map((node) => (
          <button
            key={node.id}
            onClick={() => setSelectedRule(node.id === selectedRule ? null : node.id)}
            className={`px-4 py-2 rounded-full border text-sm transition-colors ${getCategoryColor(node.category)} ${selectedRule === node.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          >
            {node.label}
          </button>
        ))}
      </div>

      <div className="p-4 border rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-3">Detail Aturan</h4>
        {selectedNode ? (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Kode:</span> {selectedNode.id}</p>
            <p><span className="font-medium">Judul:</span> {selectedNode.label}</p>
            <p><span className="font-medium">Kategori:</span> {selectedNode.category}</p>
            <p><span className="font-medium">Era:</span> {selectedNode.regime}</p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Klik salah satu aturan untuk melihat detail.</p>
        )}
      </div>
    </div>
  );
};

export { RuleGraph };

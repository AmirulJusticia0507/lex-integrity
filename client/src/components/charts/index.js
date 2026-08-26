import React from 'react';
import { LineChart as RLineChart, Line, BarChart as RBarChart, Bar, PieChart as RPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const LineChart = ({ data = [], title, description, height = 300 }) => (
  <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
    {title && <h3 className="text-lg font-semibold text-gray-800 mb-4 dark:text-gray-100">{title}</h3>}
    <div style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
        </RLineChart>
      </ResponsiveContainer>
    </div>
    {description && <p className="mt-4 text-sm text-gray-500 leading-relaxed dark:text-gray-400">{description}</p>}
  </div>
);

const BarChart = ({ data = [], title, description, height = 300 }) => (
  <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
    {title && <h3 className="text-lg font-semibold text-gray-800 mb-4 dark:text-gray-100">{title}</h3>}
    <div style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#3B82F6" />
        </RBarChart>
      </ResponsiveContainer>
    </div>
    {description && <p className="mt-4 text-sm text-gray-500 leading-relaxed dark:text-gray-400">{description}</p>}
  </div>
);

const PieChart = ({ data = [], title, height = 300 }) => {
  const truncate = (text = '', max = 20) => (text.length > max ? `${text.slice(0, max)}…` : text);
  const colorFor = (index) => `hsl(${index * 360 / (data.length || 1)}, 70%, 50%)`;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-4 dark:text-gray-100">{title}</h3>}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={90}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colorFor(index)} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, truncate(name, 30)]} />
          </RPieChart>
        </ResponsiveContainer>
      </div>
      {data.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-1">
          {data.map((entry, index) => (
            <li
              key={`legend-${index}`}
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 max-w-[14rem]"
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(index) }} />
              <span className="truncate">{truncate(entry.name)}</span>
              <span className="text-gray-500 dark:text-gray-400 shrink-0">({entry.value})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export { LineChart, BarChart, PieChart };

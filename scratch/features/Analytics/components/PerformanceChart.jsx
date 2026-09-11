import React from 'react';
import { Card } from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', impressions: 4000, claims: 2400 },
  { name: 'Feb', impressions: 3000, claims: 1398 },
  { name: 'Mar', impressions: 2000, claims: 9800 },
  { name: 'Apr', impressions: 2780, claims: 3908 },
  { name: 'May', impressions: 1890, claims: 4800 },
  { name: 'Jun', impressions: 2390, claims: 3800 },
  { name: 'Jul', impressions: 3490, claims: 4300 },
];

const PerformanceChart = ({ title, subtitle }) => {
  return (
    <Card bordered={false} className="shadow-sm rounded-2xl w-full h-full">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1677ff" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#1677ff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="impressions" stroke="#1677ff" fillOpacity={1} fill="url(#colorImpressions)" />
            <Area type="monotone" dataKey="claims" stroke="#9333ea" fillOpacity={1} fill="url(#colorClaims)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default PerformanceChart;

import React from 'react';
import { Card } from 'antd';

const StatCard = ({ title, value, icon, trend, trendValue, subtitle }) => {
  const isPositive = trend === 'up';
  
  return (
    <Card bordered={false} className="shadow-sm rounded-2xl w-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-gray-500 font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        </div>
        <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {trend && (
          <span className={`text-sm font-medium px-2 py-0.5 rounded-md ${isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
            {isPositive ? '↑' : '↓'} {trendValue}%
          </span>
        )}
        {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
      </div>
    </Card>
  );
};

export default StatCard;

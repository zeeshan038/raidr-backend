import React from 'react';
import { Row, Col } from 'antd';
import { 
  EyeOutlined, 
  GiftOutlined, 
  FireOutlined, 
  TrophyOutlined 
} from '@ant-design/icons';
import StatCard from '../components/StatCard';
import PerformanceChart from '../components/PerformanceChart';
import TrafficSourceChart from '../components/TrafficSourceChart';
import RecentActivityTable from '../components/RecentActivityTable';

const Analytics = () => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Overview</h1>
          <p className="text-gray-500">Track your campaign performance and user engagement.</p>
        </div>
      </div>

      {/* Stats Cards Row */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Total Impressions" 
            value="124.5K" 
            icon={<EyeOutlined className="text-xl" />}
            trend="up"
            trendValue={12.5}
            subtitle="vs last month"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Boxes Opened" 
            value="14,230" 
            icon={<GiftOutlined className="text-xl" />}
            trend="up"
            trendValue={8.2}
            subtitle="vs last month"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Rewards Claimed" 
            value="3,450" 
            icon={<TrophyOutlined className="text-xl" />}
            trend="down"
            trendValue={2.4}
            subtitle="vs last month"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Active Campaigns" 
            value="12" 
            icon={<FireOutlined className="text-xl" />}
            trend="up"
            trendValue={10.0}
            subtitle="vs last month"
          />
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[24, 24]} className="mt-6">
        <Col xs={24} lg={16}>
          <PerformanceChart 
            title="Engagement Over Time" 
            subtitle="Compare impressions and claims across all your campaigns."
          />
        </Col>
        <Col xs={24} lg={8}>
          <div className="bg-white p-6 rounded-2xl shadow-sm h-full w-full border border-gray-50 flex flex-col justify-center items-center">
             <div className="text-center">
               <TrophyOutlined className="text-5xl text-yellow-500 mb-4" />
               <h3 className="text-xl font-bold text-gray-900 mb-2">Top Campaign</h3>
               <p className="text-gray-500 mb-4">Summer Kickoff Quest</p>
               <div className="bg-gray-50 rounded-lg p-4 w-full">
                 <div className="flex justify-between mb-2">
                   <span className="text-gray-500">Impressions</span>
                   <span className="font-semibold">12,500</span>
                 </div>
                 <div className="flex justify-between mb-2">
                   <span className="text-gray-500">Boxes Opened</span>
                   <span className="font-semibold">4,100</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-500">Claims</span>
                   <span className="font-semibold text-[#1677ff]">2,800</span>
                 </div>
               </div>
             </div>
          </div>
        </Col>
      </Row>

      {/* Additional Stats Row */}
      <Row gutter={[24, 24]} className="mt-6 pb-10">
        <Col xs={24} lg={8}>
          <TrafficSourceChart 
            title="Traffic Sources"
            subtitle="Where your users are coming from."
          />
        </Col>
        <Col xs={24} lg={16}>
          <RecentActivityTable 
            title="Recent Activity"
            subtitle="Latest interactions from your users."
          />
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;
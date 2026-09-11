import React, { useState } from 'react';
import { Row, Col, Table, Button, Input, Tag } from 'antd';
import { 
  EnvironmentOutlined,
  ShopOutlined,
  SearchOutlined,
  PlusOutlined,
  MoreOutlined
} from '@ant-design/icons';
import StatCard from '../../Analytics/components/StatCard';

const columns = [
  {
    title: 'Location Name',
    dataIndex: 'name',
    key: 'name',
    render: (text) => <span className="font-semibold text-gray-900">{text}</span>,
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
    render: (text) => <span className="text-gray-600">{text}</span>,
  },
  {
    title: 'City',
    dataIndex: 'city',
    key: 'city',
    render: (text) => <span className="text-gray-600">{text}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      let bg = 'bg-gray-100';
      let textColor = 'text-gray-600';
      if (status === 'Active') { bg = 'bg-green-50'; textColor = 'text-green-600'; }
      if (status === 'Inactive') { bg = 'bg-red-50'; textColor = 'text-red-600'; }
      if (status === 'Coming Soon') { bg = 'bg-yellow-50'; textColor = 'text-yellow-600'; }
      return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${bg} ${textColor}`}>{status}</span>;
    },
  },
  {
    title: '',
    key: 'action',
    align: 'right',
    render: () => (
      <Button type="text" icon={<MoreOutlined className="text-gray-400" />} />
    ),
  },
];

const mockData = [
  { key: '1', name: 'Brew & Co. Downtown', address: '123 Main St, Suite 100', city: 'New York', status: 'Active' },
  { key: '2', name: 'Brew & Co. Westside', address: '456 West Ave', city: 'New York', status: 'Active' },
  { key: '3', name: 'Brew & Co. Brooklyn', address: '789 Bedford Ave', city: 'Brooklyn', status: 'Coming Soon' },
  { key: '4', name: 'Brew & Co. Pop-up', address: 'Central Park', city: 'New York', status: 'Inactive' },
];

const Location = () => {
  const [searchText, setSearchText] = useState('');

  const filteredData = mockData.filter(item => 
    item.name.toLowerCase().includes(searchText.toLowerCase()) || 
    item.address.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Locations</h1>
          <p className="text-gray-500">Manage your physical storefronts and active regions.</p>
        </div>
        <div>
          <Button type="primary" className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg flex items-center gap-1 font-medium h-10 px-5 shadow-sm">
            <PlusOutlined /> Add Location
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Total Locations" 
            value="4" 
            icon={<EnvironmentOutlined className="text-xl" />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Active Locations" 
            value="2" 
            icon={<ShopOutlined className="text-xl text-green-500" />}
          />
        </Col>
      </Row>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-6 pb-10">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex items-center gap-4 bg-white">
          <Input 
            placeholder="Search locations..." 
            prefix={<SearchOutlined className="text-gray-400" />}
            className="w-72 h-10 rounded-lg border-gray-200"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="p-0">
          <Table 
            columns={columns} 
            dataSource={filteredData} 
            pagination={false}
            rowClassName="hover:bg-gray-50 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

export default Location;

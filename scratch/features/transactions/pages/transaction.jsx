import React, { useState } from 'react';
import { Row, Col, Table, Button, Input, Tag } from 'antd';
import { 
  DollarOutlined, 
  CreditCardOutlined,
  FileDoneOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined
} from '@ant-design/icons';
import StatCard from '../../Analytics/components/StatCard';

const columns = [
  {
    title: 'Transaction ID',
    dataIndex: 'id',
    key: 'id',
    render: (text) => <span className="font-semibold text-gray-900">{text}</span>,
  },
  {
    title: 'Date',
    dataIndex: 'date',
    key: 'date',
    render: (text) => <span className="text-gray-500">{text}</span>,
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    render: (text) => <span className="text-gray-800">{text}</span>,
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    render: (amount) => <span className="font-medium text-gray-900">{amount}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      let bg = 'bg-gray-100';
      let textColor = 'text-gray-600';
      if (status === 'Paid') { bg = 'bg-green-50'; textColor = 'text-green-600'; }
      if (status === 'Pending') { bg = 'bg-yellow-50'; textColor = 'text-yellow-600'; }
      if (status === 'Failed') { bg = 'bg-red-50'; textColor = 'text-red-600'; }
      return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${bg} ${textColor}`}>{status}</span>;
    },
  },
  {
    title: 'Invoice',
    key: 'invoice',
    align: 'right',
    render: () => (
      <Button type="text" icon={<DownloadOutlined className="text-purple-600" />} className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 border-none">
        PDF
      </Button>
    ),
  },
];

const mockData = [
  { key: '1', id: 'TXN-98237', date: 'May 24, 2024', description: 'Pro Plan Subscription (Monthly)', amount: '$49.00', status: 'Paid' },
  { key: '2', id: 'TXN-87123', date: 'Apr 24, 2024', description: 'Pro Plan Subscription (Monthly)', amount: '$49.00', status: 'Paid' },
  { key: '3', id: 'TXN-76234', date: 'Mar 24, 2024', description: 'Pro Plan Subscription (Monthly)', amount: '$49.00', status: 'Paid' },
  { key: '4', id: 'TXN-65123', date: 'Feb 24, 2024', description: 'Additional Campaign Slots (x3)', amount: '$15.00', status: 'Paid' },
  { key: '5', id: 'TXN-54912', date: 'Jan 24, 2024', description: 'Starter Plan Subscription', amount: '$29.00', status: 'Failed' },
  { key: '6', id: 'TXN-43891', date: 'Dec 24, 2023', description: 'Starter Plan Subscription', amount: '$29.00', status: 'Paid' },
];

const Transaction = () => {
  const [searchText, setSearchText] = useState('');

  const filteredData = mockData.filter(item => 
    item.id.toLowerCase().includes(searchText.toLowerCase()) || 
    item.description.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Transactions</h1>
          <p className="text-gray-500">View your billing history and download invoices.</p>
        </div>
        <div>
          <Button className="bg-white border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300 rounded-lg flex items-center gap-2 font-medium h-10 px-5 shadow-sm">
            <DownloadOutlined /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard 
            title="Total Spend (YTD)" 
            value="$220.00" 
            icon={<DollarOutlined className="text-xl" />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard 
            title="Active Plan" 
            value="Pro Plan" 
            icon={<CreditCardOutlined className="text-xl text-purple-600" />}
            subtitle="Next billing: Jun 24, 2024"
          />
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <StatCard 
            title="Total Invoices" 
            value="6" 
            icon={<FileDoneOutlined className="text-xl text-blue-500" />}
          />
        </Col>
      </Row>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-6 pb-10">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <Input 
            placeholder="Search transactions..." 
            prefix={<SearchOutlined className="text-gray-400" />}
            className="w-72 h-10 rounded-lg border-gray-200"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button icon={<FilterOutlined />} className="h-10 rounded-lg border-gray-200 text-gray-600">Filter</Button>
        </div>

        {/* Table */}
        <div className="p-0">
          <Table 
            columns={columns} 
            dataSource={filteredData} 
            pagination={{ pageSize: 10, className: 'px-6 pt-4' }}
            rowClassName="hover:bg-gray-50 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

export default Transaction;
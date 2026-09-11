import React from 'react';
import { Card, Table, Tag } from 'antd';

const columns = [
  {
    title: 'User',
    dataIndex: 'user',
    key: 'user',
    render: (text) => <span className="font-medium text-gray-900">{text}</span>,
  },
  {
    title: 'Campaign',
    dataIndex: 'campaign',
    key: 'campaign',
    render: (text) => <span className="text-gray-600">{text}</span>,
  },
  {
    title: 'Action',
    dataIndex: 'action',
    key: 'action',
    render: (action) => {
      let color = 'blue';
      if (action === 'Claimed Reward') color = 'green';
      if (action === 'Opened Box') color = 'purple';
      return <Tag color={color} className="rounded-md border-none px-2 py-0.5">{action}</Tag>;
    },
  },
  {
    title: 'Time',
    dataIndex: 'time',
    key: 'time',
    render: (text) => <span className="text-gray-500 text-sm">{text}</span>,
  },
];

const data = [
  {
    key: '1',
    user: 'alex_smith92',
    campaign: 'Happy Hour Hunt',
    action: 'Claimed Reward',
    time: '2 mins ago',
  },
  {
    key: '2',
    user: 'sarah.j',
    campaign: 'Summer Kickoff Quest',
    action: 'Opened Box',
    time: '15 mins ago',
  },
  {
    key: '3',
    user: 'mike_travels',
    campaign: 'Weekend Treasure',
    action: 'Claimed Reward',
    time: '1 hour ago',
  },
  {
    key: '4',
    user: 'emma_w',
    campaign: 'Student Special',
    action: 'Opened Box',
    time: '3 hours ago',
  },
  {
    key: '5',
    user: 'jason_k',
    campaign: 'Happy Hour Hunt',
    action: 'Opened Box',
    time: '5 hours ago',
  },
];

const RecentActivityTable = ({ title, subtitle }) => {
  return (
    <Card bordered={false} className="shadow-sm rounded-2xl w-full h-full" bodyStyle={{ padding: 0 }}>
      <div className="p-6 border-b border-gray-50">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <Table 
        columns={columns} 
        dataSource={data} 
        pagination={false}
        className="w-full"
        rowClassName="hover:bg-gray-50 transition-colors"
      />
    </Card>
  );
};

export default RecentActivityTable;

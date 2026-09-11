import { useState, useEffect } from 'react';
import { Row, Col, Table, Button, Input, Tag } from 'antd';
import { 
  GiftOutlined, 
  ShopOutlined, 
  ShoppingCartOutlined, 
  WarningOutlined,
  SearchOutlined,
  PlusOutlined
} from '@ant-design/icons';
import StatCard from '../../Analytics/components/StatCard';
import { compaignApi } from '../../compaign/api/compaign';
import { useDispatch } from 'react-redux';

const columns = [
  {
    title: 'Reward Name',
    dataIndex: 'name',
    key: 'name',
    render: (text) => <span className="font-semibold text-gray-900">{text}</span>,
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    render: (type) => {
      const isGeo = type && type.toLowerCase().includes('geo');
      const color = isGeo ? 'geekblue' : 'purple';
      return <Tag color={color} className="rounded-md border-none px-2 py-0.5 capitalize">{type}</Tag>;
    },
  },
  {
    title: 'Stock Remaining',
    dataIndex: 'stock',
    key: 'stock',
    render: (stock) => (
      <span className={`font-medium ${stock < 20 ? 'text-red-500' : 'text-gray-700'}`}>
        {stock === 0 ? 'Out of Stock' : stock}
      </span>
    ),
  },
  {
    title: 'Total Claimed',
    dataIndex: 'claimed',
    key: 'claimed',
    render: (claimed) => <span className="font-medium text-gray-700">{claimed}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      let bg = 'bg-gray-100';
      let textColor = 'text-gray-600';
      if (status === 'Active') { bg = 'bg-green-50'; textColor = 'text-green-600'; }
      if (status === 'Low Stock') { bg = 'bg-yellow-50'; textColor = 'text-yellow-600'; }
      if (status === 'Out of Stock') { bg = 'bg-red-50'; textColor = 'text-red-600'; }
      return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${bg} ${textColor}`}>{status}</span>;
    },
  },
];

const Reward = () => {
  const dispatch = useDispatch();
  const [searchText, setSearchText] = useState('');
  const [rewardsData, setRewardsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const campaigns = await dispatch(compaignApi.endpoints.getCampaigns.initiate()).unwrap();
        const mappedRewards = campaigns.map(camp => {
          const limit = Number(camp.stockLimit) || 0;
          const claimed = Number(camp.rewardClaims) || 0;
          const remaining = Math.max(0, limit - claimed);
          
          let status = 'Active';
          if (limit > 0 && remaining === 0) {
            status = 'Out of Stock';
          } else if (limit > 0 && remaining <= 20) {
            status = 'Low Stock';
          } else if (limit === 0 && claimed > 0) {
              status = 'Active';
          }
          
          return {
            key: camp.id,
            name: camp.mysteryBoxReward || camp.adTitle || 'Unknown Reward',
            type: camp.adCategory || 'Unknown Type',
            stock: limit === 0 ? 'Unlimited' : remaining, 
            stockValue: limit === 0 ? 999999 : remaining, 
            claimed: claimed,
            status: status
          };
        });
        setRewardsData(mappedRewards);
      } catch (error) {
        console.error("Failed to fetch rewards", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, []);

  const filteredData = rewardsData.filter(item => 
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const totalRewards = rewardsData.length;
  const totalClaimed = rewardsData.reduce((acc, curr) => acc + curr.claimed, 0);
  const lowStockItems = rewardsData.filter(r => r.status === 'Low Stock').length;
  const outOfStockItems = rewardsData.filter(r => r.status === 'Out of Stock').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rewards & Inventory</h1>
          <p className="text-gray-500">Manage your reward items and track inventory levels.</p>
        </div>
        <div>
          <Button type="primary" className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg flex items-center gap-1 font-medium h-10 px-5 shadow-sm">
            <PlusOutlined /> Add Reward
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Total Rewards" 
            value={totalRewards.toString()} 
            icon={<GiftOutlined className="text-xl" />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Total Claimed" 
            value={totalClaimed.toLocaleString()} 
            icon={<ShoppingCartOutlined className="text-xl" />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Low Stock Items" 
            value={lowStockItems.toString()} 
            icon={<WarningOutlined className="text-xl text-yellow-500" />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            title="Out of Stock" 
            value={outOfStockItems.toString()} 
            icon={<ShopOutlined className="text-xl text-red-500" />}
          />
        </Col>
      </Row>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-6 pb-10">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex items-center gap-4 bg-white">
          <Input 
            placeholder="Search rewards..." 
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
            loading={loading}
            pagination={{ pageSize: 10, className: 'px-6 pt-4' }}
            rowClassName="hover:bg-gray-50 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

export default Reward;

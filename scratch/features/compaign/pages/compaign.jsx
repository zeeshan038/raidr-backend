import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Dropdown, Popconfirm, message, Switch } from 'antd';
import { SearchOutlined, PlusOutlined, MoreOutlined, FilterOutlined, EditOutlined, DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { auth } from '../../../firebase'; // Kept for any other usages, though unused here
import CreateCampaignModal from '../components/CreateCampaignModal';
import { compaignApi } from '../api/compaign';
import { useDispatch, useSelector } from 'react-redux';

const { Option } = Select;

export default function Compaign() {
  const dispatch = useDispatch();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await dispatch(compaignApi.endpoints.getCampaigns.initiate()).unwrap();
      // Map Firebase schema to the table schema
      const formattedData = data.map(doc => {
        let dateString = '-';
        if (doc.createdAt && doc.createdAt.toDate) {
            dateString = doc.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }

        return {
          key: doc.id,
          name: doc.adTitle || 'Unnamed Campaign',
          isActive: doc.isActive !== false,
          duration: dateString,
          impressions: doc.impressions || 0,
          boxes: doc.boxOpens || 0,
          claims: doc.rewardClaims || 0,
          adCategory: doc.adCategory || '-',
          address: doc.address || '-',
          reward: doc.mysteryBoxReward || '-',
          stockLimit: doc.stockLimit || '-',
          image: doc.imageUrl || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=100&h=100&fit=crop',
          rawData: doc
        };
      });
      setCampaigns(formattedData);
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (id) => {
    try {
      await dispatch(compaignApi.endpoints.deleteCampaign.initiate(id)).unwrap();
      message.success('Campaign deleted successfully');
      fetchCampaigns();
    } catch (e) {
      console.error(e);
      message.error('Failed to delete campaign');
    }
  };

  const handleEdit = (record) => {
    setEditingCampaign(record.rawData);
    setIsModalVisible(true);
  };

  const handleToggleStatus = async (id, checked) => {
    // Optimistic UI update: instantly change the state
    const originalCampaigns = [...campaigns];
    setCampaigns(prev => prev.map(campaign => 
      campaign.key === id ? { ...campaign, isActive: checked } : campaign
    ));

    try {
      await dispatch(compaignApi.endpoints.toggleCampaignStatus.initiate({ id, isActive: checked })).unwrap();
      message.success(`Campaign ${checked ? 'activated' : 'paused'} successfully`);
    } catch (e) {
      console.error(e);
      // Revert if API call fails
      setCampaigns(originalCampaigns);
      message.error('Failed to update status');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-3 py-1">
          <img src={record.image} alt={text} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
          <span className="font-semibold text-gray-900">{text}</span>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'adCategory',
      key: 'adCategory',
      render: (text) => <span className="text-sm text-gray-700 capitalize">{text}</span>,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      render: (text) => (
        <span className="text-sm text-gray-600 block max-w-[200px] truncate" title={text}>
          {text}
        </span>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => (
        <div className="text-xs text-gray-500">
          <div>Created on</div>
          <div>{record.duration}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive, record) => (
        <Switch 
          checked={isActive} 
          onChange={(checked) => handleToggleStatus(record.key, checked)} 
          className={isActive ? 'bg-green-500' : 'bg-gray-300'}
        />
      ),
    },
    {
      title: 'Reward',
      dataIndex: 'reward',
      key: 'reward',
      render: (text) => <span className="text-sm text-gray-700">{text}</span>,
    },
    {
      title: 'Stock Limit',
      dataIndex: 'stockLimit',
      key: 'stockLimit',
      render: (text) => <span className="font-medium text-gray-700">{text}</span>,
    },
    {
      title: 'Impressions',
      dataIndex: 'impressions',
      key: 'impressions',
      render: (text) => <span className="font-medium text-gray-700">{text}</span>,
    },
    {
      title: 'Box Opens',
      dataIndex: 'boxes',
      key: 'boxes',
      render: (text) => <span className="font-medium text-gray-700">{text}</span>,
    },
    {
      title: 'Reward Claims',
      dataIndex: 'claims',
      key: 'claims',
      render: (text) => <span className="font-medium text-gray-700">{text}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={`/campaigns/${record.key}`}>
            <Button type="text" icon={<EyeOutlined className="text-gray-500 hover:text-green-500" />} />
          </Link>
          <Button type="text" onClick={() => handleEdit(record)} icon={<EditOutlined className="text-gray-500 hover:text-[#1677ff]" />} />
          <Popconfirm
            title="Delete Campaign"
            description="Are you sure you want to delete this campaign?"
            onConfirm={() => handleDelete(record.key)}
            okText="Yes"
            cancelText="No"
            placement="topLeft"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const filteredData = campaigns.filter(item => {
    return item.name.toLowerCase().includes(searchText.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Campaigns</h1>
          <p className="text-gray-500">Manage all your mystery box quests in one place.</p>
        </div>
        <div>
          <Button type="primary" onClick={() => setIsModalVisible(true)} className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg flex items-center gap-1 font-medium h-10 px-5 shadow-sm">
            <PlusOutlined /> Create Campaign
          </Button>
        </div>
      </div>

      {/* Filters and Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex items-center gap-4 bg-white">
          <Input 
            placeholder="Search campaigns..." 
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
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, className: 'px-6 pt-4' }}
            rowClassName="hover:bg-gray-50 transition-colors"
          />
        </div>
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal 
        visible={isModalVisible} 
        editData={editingCampaign}
        onClose={() => {
            setIsModalVisible(false);
            setEditingCampaign(null);
        }} 
        onSuccess={() => {
            setIsModalVisible(false);
            setEditingCampaign(null);
            fetchCampaigns();
        }}
      />
    </div>
  );
}
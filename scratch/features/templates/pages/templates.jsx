import React, { useState } from 'react';
import { Row, Col, Card, Button, Input, Tabs, Tag } from 'antd';
import { 
  SearchOutlined, 
  FormatPainterOutlined,
  EyeOutlined,
  AppstoreAddOutlined
} from '@ant-design/icons';

const mockTemplates = [
  {
    id: 1,
    title: 'Summer Splash',
    category: 'Campaign Pages',
    description: 'A vibrant, energetic layout perfect for summer sales and giveaways.',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&h=300&fit=crop',
    color: 'blue'
  },
  {
    id: 2,
    title: 'Minimalist Dark',
    category: 'Campaign Pages',
    description: 'Sleek dark mode design tailored for premium or tech brands.',
    image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&h=300&fit=crop',
    color: 'purple'
  },
  {
    id: 3,
    title: 'Holiday Special',
    category: 'Campaign Pages',
    description: 'Festive theme designed to maximize engagement during holiday seasons.',
    image: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=500&h=300&fit=crop',
    color: 'red'
  },
  {
    id: 4,
    title: 'Welcome Email',
    category: 'Email Templates',
    description: 'Clean, high-converting welcome email for new participants.',
    image: 'https://images.unsplash.com/photo-1579389083046-d3ce1a2ce718?w=500&h=300&fit=crop',
    color: 'green'
  },
  {
    id: 5,
    title: 'Reward Claimed',
    category: 'Email Templates',
    description: 'Automated receipt and congratulations email when a user claims a reward.',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&h=300&fit=crop',
    color: 'orange'
  },
  {
    id: 6,
    title: 'Classic Gold Box',
    category: 'Box Designs',
    description: 'The standard premium gold mystery box 3D asset.',
    image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=500&h=300&fit=crop',
    color: 'gold'
  }
];

const TemplateCard = ({ template }) => (
  <Card 
    bordered={false} 
    className="overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl h-full flex flex-col group cursor-pointer"
    bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
  >
    <div className="relative h-48 w-full overflow-hidden bg-gray-100">
      <img 
        src={template.image} 
        alt={template.title} 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      {/* Overlay actions on hover */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
        <Button type="primary" shape="round" icon={<AppstoreAddOutlined />} className="bg-[#1677ff] border-none font-medium">
          Use Template
        </Button>
        <Button shape="circle" icon={<EyeOutlined />} className="bg-white border-none text-gray-700" />
      </div>
      <Tag color={template.color} className="absolute top-3 right-3 m-0 rounded-md border-none font-medium opacity-90">
        {template.category}
      </Tag>
    </div>
    <div className="p-5 flex-1 flex flex-col">
      <h3 className="text-lg font-bold text-gray-900 mb-2">{template.title}</h3>
      <p className="text-gray-500 text-sm flex-1">{template.description}</p>
    </div>
  </Card>
);

const Templates = () => {
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const filteredTemplates = mockTemplates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchText.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchText.toLowerCase());
    const matchesTab = activeTab === 'All' || t.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const tabItems = [
    { key: 'All', label: 'All Templates' },
    { key: 'Campaign Pages', label: 'Campaign Pages' },
    { key: 'Email Templates', label: 'Email Templates' },
    { key: 'Box Designs', label: 'Box Designs' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Templates</h1>
          <p className="text-gray-500">Jumpstart your next campaign with our beautifully designed templates.</p>
        </div>
        <div>
          <Button type="default" className="border-gray-200 rounded-lg flex items-center gap-1 font-medium h-10 px-5 shadow-sm">
            <FormatPainterOutlined /> Custom CSS
          </Button>
        </div>
      </div>

      {/* Controls: Tabs & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-50">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={tabItems}
          className="w-full sm:w-auto px-4 custom-template-tabs"
          style={{ marginBottom: 0 }}
        />
        <Input 
          placeholder="Search templates..." 
          prefix={<SearchOutlined className="text-gray-400" />}
          className="w-full sm:w-72 h-10 rounded-xl border-gray-200 bg-gray-50/50 hover:bg-white focus:bg-white transition-colors mr-2"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* Grid */}
      {filteredTemplates.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredTemplates.map(template => (
            <Col xs={24} sm={12} lg={8} key={template.id}>
              <TemplateCard template={template} />
            </Col>
          ))}
        </Row>
      ) : (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-50 shadow-sm">
          <FormatPainterOutlined className="text-4xl text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-600">No templates found</h3>
          <p className="text-gray-400">Try adjusting your search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default Templates;

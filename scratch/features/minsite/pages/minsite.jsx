import React, { useState } from 'react';
import { Row, Col, Card, Form, Input, Button, Upload, ColorPicker, Divider, Tabs } from 'antd';
import { 
  UploadOutlined, 
  LinkOutlined, 
  CopyOutlined,
  SaveOutlined,
  MobileOutlined,
  GlobalOutlined,
  InstagramOutlined,
  TwitterOutlined,
  FacebookOutlined
} from '@ant-design/icons';

const Minsite = () => {
  const [form] = Form.useForm();
  const [themeColor, setThemeColor] = useState('#1677ff');
  const [previewData, setPreviewData] = useState({
    title: 'Brew & Co.',
    description: 'Welcome to our official mystery box store! Grab a box and win amazing rewards.',
    logo: null,
    banner: null
  });

  const handleValuesChange = (changedValues, allValues) => {
    setPreviewData(prev => ({ ...prev, ...allValues }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MiniSite Builder</h1>
          <p className="text-gray-500">Customize your public landing page where customers can find your campaigns.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-gray-200 rounded-lg flex items-center px-3 h-10 shadow-sm">
            <LinkOutlined className="text-gray-400 mr-2" />
            <span className="text-gray-600 mr-4 text-sm">raidr.com/m/brewco</span>
            <Button type="text" size="small" icon={<CopyOutlined />} className="text-purple-600 hover:text-purple-700" />
          </div>
          <Button type="primary" className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg flex items-center gap-1 font-medium h-10 px-5 shadow-sm">
            <SaveOutlined /> Save Changes
          </Button>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Editor */}
        <Col xs={24} lg={16}>
          <Card bordered={false} className="shadow-sm rounded-2xl">
            <Tabs defaultActiveKey="1" items={[
              {
                key: '1',
                label: 'General Information',
                children: (
                  <Form 
                    layout="vertical" 
                    form={form} 
                    initialValues={previewData}
                    onValuesChange={handleValuesChange}
                    className="mt-4"
                  >
                    <Form.Item label="Store Name" name="title">
                      <Input size="large" className="rounded-lg" />
                    </Form.Item>
                    <Form.Item label="Description" name="description">
                      <Input.TextArea rows={4} className="rounded-lg" />
                    </Form.Item>
                    
                    <Divider />
                    
                    <h3 className="font-semibold text-gray-900 mb-4">Branding</h3>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Logo">
                          <Upload action="/upload.do" listType="picture-card" maxCount={1}>
                            <div>
                              <UploadOutlined />
                              <div style={{ marginTop: 8 }}>Upload Logo</div>
                            </div>
                          </Upload>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Cover Banner">
                          <Upload action="/upload.do" listType="picture-card" maxCount={1} className="w-full">
                            <div>
                              <UploadOutlined />
                              <div style={{ marginTop: 8 }}>Upload Banner</div>
                            </div>
                          </Upload>
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Form.Item label="Theme Color">
                      <ColorPicker value={themeColor} onChange={(color) => setThemeColor(color.toHexString())} />
                    </Form.Item>
                  </Form>
                )
              },
              {
                key: '2',
                label: 'Social Links',
                children: (
                  <Form layout="vertical" className="mt-4">
                    <Form.Item label="Website">
                      <Input size="large" prefix={<GlobalOutlined className="text-gray-400" />} placeholder="https://" className="rounded-lg" />
                    </Form.Item>
                    <Form.Item label="Instagram">
                      <Input size="large" prefix={<InstagramOutlined className="text-gray-400" />} placeholder="@username" className="rounded-lg" />
                    </Form.Item>
                    <Form.Item label="Twitter">
                      <Input size="large" prefix={<TwitterOutlined className="text-gray-400" />} placeholder="@username" className="rounded-lg" />
                    </Form.Item>
                    <Form.Item label="Facebook">
                      <Input size="large" prefix={<FacebookOutlined className="text-gray-400" />} placeholder="facebook.com/page" className="rounded-lg" />
                    </Form.Item>
                  </Form>
                )
              }
            ]} />
          </Card>
        </Col>

        {/* Right Column: Preview */}
        <Col xs={24} lg={8}>
          <div className="bg-gray-100 rounded-3xl p-6 flex items-center justify-center border-[8px] border-gray-200 mx-auto max-w-[350px] shadow-inner relative overflow-hidden" style={{ height: '600px' }}>
            {/* Top Speaker/Notch mock */}
            <div className="absolute top-0 w-32 h-6 bg-gray-200 rounded-b-xl left-1/2 -translate-x-1/2 z-10"></div>
            
            <div className="bg-white w-full h-full rounded-2xl overflow-hidden flex flex-col relative shadow-sm">
              {/* Cover Photo */}
              <div className="h-32 bg-gray-200 w-full relative" style={{ backgroundColor: themeColor, opacity: 0.8 }}>
                {/* Logo overlapping */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-white shadow-sm flex items-center justify-center font-bold text-xl text-gray-400">
                  Logo
                </div>
              </div>
              
              {/* Content */}
              <div className="px-4 pt-10 pb-4 text-center flex-1 overflow-y-auto">
                <h2 className="text-lg font-bold text-gray-900 mb-1">{previewData.title || 'Store Name'}</h2>
                <p className="text-xs text-gray-500 mb-4">{previewData.description || 'Add a description...'}</p>
                
                <div className="flex justify-center gap-2 mb-6 text-gray-400">
                  <GlobalOutlined />
                  <InstagramOutlined />
                  <TwitterOutlined />
                </div>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <div className="text-left">
                  <h3 className="font-semibold text-sm mb-3">Active Campaigns</h3>
                  {/* Mock Campaign Card */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-3 shadow-sm text-left flex gap-3">
                     <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                     <div className="flex-1">
                       <h4 className="font-semibold text-xs text-gray-900">Summer Quest</h4>
                       <p className="text-[10px] text-gray-500">Ends in 2 days</p>
                     </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 shadow-sm text-left flex gap-3">
                     <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                     <div className="flex-1">
                       <h4 className="font-semibold text-xs text-gray-900">Weekend Special</h4>
                       <p className="text-[10px] text-gray-500">Ends in 5 days</p>
                     </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-100 bg-white">
                 <Button type="primary" block style={{ backgroundColor: themeColor, borderColor: themeColor }} className="rounded-lg">
                   Follow Store
                 </Button>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <span className="text-sm text-gray-500 flex items-center justify-center gap-1">
              <MobileOutlined /> Live Mobile Preview
            </span>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Minsite;
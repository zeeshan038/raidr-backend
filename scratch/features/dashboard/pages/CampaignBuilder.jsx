import React, { useState } from 'react';
import { Form, Input, Select, Switch, Button, Radio, InputNumber, Slider } from 'antd';
import { MapPin, Box, Zap, EyeOff, Target, Navigation } from 'lucide-react';

const { Option } = Select;
const { TextArea } = Input;

export default function CampaignBuilder() {
    const [form] = Form.useForm();
    const [businessType, setBusinessType] = useState('physical');
    const [spawnLogic, setSpawnLogic] = useState('default');

    const handleFinish = (values) => {
        console.log('Campaign values:', values);
        // Here we would normally send this to our backend database logic
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Campaign</h1>
                    <p className="text-gray-500">Configure your mystery box locations and spawning logic.</p>
                </div>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{ businessType: 'physical', spawnLogic: 'default', triggerRadius: 50, geofenceRadius: 5 }}
            >
                {/* Basic Details */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Box className="text-purple-600" size={24} /> Basic Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item name="campaignName" label="Campaign Name" rules={[{ required: true }]}>
                            <Input placeholder="e.g. Weekend Treasure Hunt" className="h-10 rounded-lg" />
                        </Form.Item>
                        <Form.Item name="rewardType" label="Reward Type" rules={[{ required: true }]}>
                            <Select placeholder="Select reward type" className="h-10">
                                <Option value="discount">Discount Coupon</Option>
                                <Option value="freebie">Free Item</Option>
                                <Option value="points">Loyalty Points</Option>
                            </Select>
                        </Form.Item>
                    </div>
                    <Form.Item name="description" label="Description">
                        <TextArea rows={3} placeholder="Describe the campaign..." className="rounded-lg" />
                    </Form.Item>
                </div>

                {/* Geofencing & Location Settings */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <MapPin className="text-blue-500" size={24} /> Geofencing & Location
                    </h2>
                    <p className="text-gray-500 text-sm mb-4">Set where your boxes will appear.</p>
                    
                    <Form.Item name="businessType" label="Business Type">
                        <Radio.Group 
                            onChange={(e) => setBusinessType(e.target.value)} 
                            value={businessType}
                            className="flex gap-4"
                        >
                            <Radio.Button value="physical" className="h-auto py-2 px-4 rounded-lg flex-1 text-center">
                                Physical Store
                            </Radio.Button>
                            <Radio.Button value="digital" className="h-auto py-2 px-4 rounded-lg flex-1 text-center">
                                Digital/Online Business
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {businessType === 'digital' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                            <h3 className="font-semibold text-blue-900 mb-2">Digital Business Geofencing</h3>
                            <p className="text-blue-700 text-sm mb-4">Since you don't have a physical store, select a radius on the map where your mystery boxes will automatically spread.</p>
                            <Form.Item name="geofenceRadius" label="Spread Radius (km)">
                                <Slider min={1} max={50} marks={{ 1: '1km', 50: '50km' }} />
                            </Form.Item>
                            <div className="h-[300px] bg-gray-200 rounded-lg overflow-hidden relative">
                                <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop" alt="Map" className="w-full h-full object-cover opacity-60 mix-blend-luminosity" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-48 h-48 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
                                        <Target className="text-blue-600" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Surprise Box Spawning Logic */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Zap className="text-orange-500" size={24} /> Surprise Box Spawning Logic
                    </h2>
                    <p className="text-gray-500 text-sm mb-6">Choose how users discover your boxes to maximize engagement and foot traffic.</p>
                    
                    <Form.Item name="spawnLogic">
                        <Radio.Group 
                            onChange={(e) => setSpawnLogic(e.target.value)} 
                            className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
                        >
                            {/* Default */}
                            <Radio.Button value="default" className="h-auto p-4 rounded-xl text-left border-gray-200">
                                <div className="font-bold text-gray-900 mb-1 flex items-center gap-2"><MapPin size={16}/> Visible on Map</div>
                                <div className="text-xs text-gray-500 whitespace-normal">Users can see this box from anywhere on the city map.</div>
                            </Radio.Button>

                            {/* 50m Trigger */}
                            <Radio.Button value="proximity" className="h-auto p-4 rounded-xl text-left border-gray-200">
                                <div className="font-bold text-gray-900 mb-1 flex items-center gap-2"><EyeOff size={16}/> Hidden (Proximity)</div>
                                <div className="text-xs text-gray-500 whitespace-normal">Box is completely hidden. Only appears with a surprise animation when user is within 50 meters.</div>
                            </Radio.Button>

                            {/* On-Track */}
                            <Radio.Button value="on_track" className="h-auto p-4 rounded-xl text-left border-gray-200">
                                <div className="font-bold text-gray-900 mb-1 flex items-center gap-2"><Navigation size={16}/> On-Track Spawning</div>
                                <div className="text-xs text-gray-500 whitespace-normal">Premium boxes that only appear near the user's current walking path or route.</div>
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {spawnLogic === 'proximity' && (
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mt-4 animate-fade-in">
                            <Form.Item name="triggerRadius" label="Trigger Radius (meters)" className="mb-0">
                                <InputNumber min={10} max={200} className="w-full max-w-[200px]" addonAfter="meters" />
                            </Form.Item>
                            <p className="text-orange-700 text-xs mt-2">Recommended: 50 meters. The box will suddenly appear on the user's screen with a sound effect when they cross this distance.</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <Button size="large" className="rounded-lg">Cancel</Button>
                    <Button type="primary" htmlType="submit" size="large" className="bg-purple-600 hover:bg-purple-700 rounded-lg">
                        Create Campaign
                    </Button>
                </div>
            </Form>
        </div>
    );
}

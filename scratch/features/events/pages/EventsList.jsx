import React, { useState } from 'react';
import { Table, Button, Tag, Space, Typography, Card, Tooltip, Modal, message, Tabs, Input } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined, ExclamationCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { 
    useGetMyEventsQuery, 
    useDeleteEventMutation,
    useGetMyCoinRushEventsQuery,
    useDeleteCoinRushMutation
} from '../api/eventsApi';

const { Title } = Typography;

export default function EventsList() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('normal');
    
    // AI Modal State
    const [isAIModalVisible, setIsAIModalVisible] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAIGenerating, setIsAIGenerating] = useState(false);

    // Normal Events
    const { data: eventsData, isLoading: isEventsLoading } = useGetMyEventsQuery(undefined, {
        skip: activeTab !== 'normal'
    });
    const [deleteEvent] = useDeleteEventMutation();

    // Coin Rush Events
    const { data: coinRushData, isLoading: isCoinRushLoading } = useGetMyCoinRushEventsQuery(undefined, {
        skip: activeTab !== 'coin_rush'
    });
    const [deleteCoinRush] = useDeleteCoinRushMutation();

    const showDeleteConfirm = (eventId, isCoinRush) => {
        Modal.confirm({
            title: `Are you sure you want to delete this ${isCoinRush ? 'Coin Rush' : 'event'}?`,
            icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
            content: 'This action cannot be undone.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    if (isCoinRush) {
                        await deleteCoinRush(eventId).unwrap();
                    } else {
                        await deleteEvent(eventId).unwrap();
                    }
                    message.success(`${isCoinRush ? 'Coin Rush' : 'Event'} deleted successfully`);
                } catch (error) {
                    message.error(error?.data?.msg || error?.data?.message || 'Failed to delete');
                }
            },
        });
    };

    const handleAIGenerate = () => {
        if (!aiPrompt.trim()) {
            message.warning('Please enter a prompt for the AI.');
            return;
        }
        setIsAIGenerating(true);
        // Simulate AI backend generation delay
        setTimeout(() => {
            setIsAIGenerating(false);
            setIsAIModalVisible(false);
            setAiPrompt('');
            
            // Mock AI JSON Response
            const mockJson = {
                eventMode: 'coin_rush',
                coinRushType: 'GPS',
                gpsMode: 'auto',
                title: 'AI Generated Epic Hunt',
                description: aiPrompt,
                checkpointCount: 5,
                radiusMeter: 1000,
                rewardType: 'DIGITAL_COUPON',
                rewardTitle: 'Free Premium Coffee',
                rewardValue: 5.00,
                rewardDescription: 'Enjoy a free premium coffee at our main branch.',
                rewardClaimInstructions: 'Show this digital coupon to the barista.',
                address: 'Dubai Mall, Downtown Dubai',
                latitude: 25.1972,
                longitude: 55.2744
            };
            
            message.success('AI successfully generated event data!');
            navigate('/events/new', { state: { aiEventData: mockJson } });
        }, 1500);
    };

    const normalEvents = eventsData?.events || [];
    const coinRushEvents = coinRushData?.events || [];

    const normalColumns = [
        {
            title: 'Event Title',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Location',
            dataIndex: 'address',
            key: 'address',
            render: (text) => (
                <div className="truncate max-w-[200px] text-gray-600" title={text}>
                    {text || 'N/A'}
                </div>
            ),
        },
        {
            title: 'Reward',
            dataIndex: 'reward',
            key: 'reward',
        },
        {
            title: 'Quantity',
            dataIndex: 'rewardQuantity',
            key: 'rewardQuantity',
        },
        {
            title: 'Schedule',
            key: 'schedule',
            render: (_, record) => {
                const start = record.startTime ? new Date(record.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
                const end = record.endTime ? new Date(record.endTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
                return (
                    <div className="text-xs whitespace-nowrap text-gray-600">
                        <div><span className="font-medium text-gray-500">Start:</span> {start}</div>
                        <div><span className="font-medium text-gray-500">End:</span> {end}</div>
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                if (!status) return null;
                let color = 'geekblue';
                const lowerStatus = status.toLowerCase();
                if (lowerStatus === 'live') color = 'green';
                if (lowerStatus === 'draft') color = 'default';
                if (lowerStatus === 'scheduled') color = 'cyan';
                if (lowerStatus === 'completed') color = 'purple';
                if (lowerStatus === 'cancelled') color = 'red';
                if (lowerStatus === 'pending_approval') color = 'orange';
                return <Tag color={color}>{status.replace('_', ' ').toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="View">
                        <Button type="text" onClick={() => navigate(`/events/${record.id}`)} icon={<EyeOutlined className="text-blue-500" />} />
                    </Tooltip>
                    <Tooltip title="Update">
                        <Button type="text" onClick={() => navigate(`/events/${record.id}/edit`)} icon={<EditOutlined className="text-green-500" />} />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => showDeleteConfirm(record.id, false)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const coinRushColumns = [
        {
            title: 'Event Title',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Type',
            dataIndex: 'eventType',
            key: 'eventType',
            render: (type) => (
                <Tag color={type === 'GPS' ? 'blue' : 'purple'}>
                    {type}
                </Tag>
            )
        },
        {
            title: 'Checkpoints',
            dataIndex: 'checkpointCount',
            key: 'checkpointCount',
            render: (count) => `${count} Checkpoints`
        },
        {
            title: 'Reward',
            key: 'reward',
            render: (_, record) => (
                <div>
                    <span className="font-semibold text-gray-700">{record.rewardTitle}</span>
                    <span className="text-xs text-gray-400 ml-1">({record.rewardType})</span>
                </div>
            )
        },
        {
            title: 'Schedule',
            key: 'schedule',
            render: (_, record) => {
                const start = record.startTime ? new Date(record.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
                const end = record.endTime ? new Date(record.endTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
                return (
                    <div className="text-xs whitespace-nowrap text-gray-600">
                        <div><span className="font-medium text-gray-500">Start:</span> {start}</div>
                        <div><span className="font-medium text-gray-500">End:</span> {end}</div>
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                if (!status) return null;
                let color = 'geekblue';
                const lowerStatus = status.toLowerCase();
                if (lowerStatus === 'live') color = 'green';
                if (lowerStatus === 'draft') color = 'default';
                if (lowerStatus === 'scheduled') color = 'cyan';
                if (lowerStatus === 'completed') color = 'purple';
                if (lowerStatus === 'cancelled') color = 'red';
                return <Tag color={color}>{status.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="View">
                        <Button type="text" onClick={() => navigate(`/events/${record.id}?coinRush=true`)} icon={<EyeOutlined className="text-blue-500" />} />
                    </Tooltip>
                    <Tooltip title="Update">
                        <Button type="text" onClick={() => navigate(`/events/${record.id}/edit?coinRush=true`)} icon={<EditOutlined className="text-green-500" />} />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => showDeleteConfirm(record.id, true)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const tabItems = [
        {
            key: 'normal',
            label: 'Normal Raids',
            children: (
                <Table 
                    columns={normalColumns} 
                    dataSource={normalEvents} 
                    rowKey="id" 
                    pagination={{ pageSize: 10 }} 
                    loading={isEventsLoading}
                />
            )
        },
        {
            key: 'coin_rush',
            label: 'Coin Rush Events',
            children: (
                <Table 
                    columns={coinRushColumns} 
                    dataSource={coinRushEvents} 
                    rowKey="id" 
                    pagination={{ pageSize: 10 }} 
                    loading={isCoinRushLoading}
                />
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Title level={2} className="!m-0">Events Management</Title>
                <Space>
                    <Button 
                        type="default" 
                        icon={<RobotOutlined className="text-purple-500" />} 
                        onClick={() => setIsAIModalVisible(true)}
                        className="border-purple-200 text-purple-700 hover:text-purple-800 hover:border-purple-400 bg-purple-50"
                    >
                        Create with AI
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/events/new')}>
                        Create Event
                    </Button>
                </Space>
            </div>

            <Card className="shadow-sm rounded-xl border-gray-200">
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab} 
                    items={tabItems}
                />
            </Card>

            {/* AI Event Creation Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <RobotOutlined className="text-purple-500 text-xl" />
                        <span>Create Event with AI</span>
                    </div>
                }
                open={isAIModalVisible}
                onCancel={() => !isAIGenerating && setIsAIModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsAIModalVisible(false)} disabled={isAIGenerating}>
                        Cancel
                    </Button>,
                    <Button 
                        key="generate" 
                        type="primary" 
                        onClick={handleAIGenerate} 
                        loading={isAIGenerating}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        Generate Event
                    </Button>,
                ]}
            >
                <div className="space-y-4 py-4">
                    <Typography.Text className="text-gray-600">
                        Describe the event you want to create, and our AI will automatically fill out the form for you.
                    </Typography.Text>
                    <div>
                        <Input.TextArea
                            rows={5}
                            placeholder="e.g. Create a GPS-based Coin Rush event at Downtown Dubai. It should have 7 checkpoints within a 1km radius. The reward should be a Digital Coupon worth $10 for a free lunch meal."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                        <Typography.Text className="text-xs text-purple-800 font-medium">
                            💡 Tip: Include location, number of checkpoints, event type, and reward details for the best results!
                        </Typography.Text>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

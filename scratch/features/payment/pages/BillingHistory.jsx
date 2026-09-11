import React, { useState } from 'react';
import { Typography, Card, Table, Tag, Tabs } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { useGetBillingHistoryQuery, useGetMerchantPurchaseHistoryQuery } from '../api/paymentApi';

const { Title, Text } = Typography;

export default function BillingHistory() {
    const credits = useSelector((state) => state.auth.credits);
    const { data: historyData, isLoading } = useGetBillingHistoryQuery(undefined, { refetchOnMountOrArgChange: true });

    // Pagination state for Store Purchase History
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const { data: purchaseData, isLoading: purchaseLoading } = useGetMerchantPurchaseHistoryQuery(
        { page, limit },
        { refetchOnMountOrArgChange: true }
    );

    const logColumns = [
        {
            title: 'Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text) => new Date(text).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type) => {
                let color = 'blue';
                if (type === 'purchase' || type === 'refund') color = 'green';
                if (type === 'event_creation') color = 'orange';
                return (
                    <Tag color={color}>
                        {type.toUpperCase().replace('_', ' ')}
                    </Tag>
                );
            }
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount) => (
                <span className={`font-bold ${amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {amount > 0 ? '+' : ''}{amount}
                </span>
            ),
        },
    ];

    const storePurchaseColumns = [
        {
            title: 'Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text) => new Date(text).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        },
        {
            title: 'Transaction ID',
            dataIndex: 'transactionId',
            key: 'transactionId',
            render: (text) => <Text copyable>{text}</Text>,
        },
        {
            title: 'Coins Purchased',
            dataIndex: 'creditsAmount',
            key: 'creditsAmount',
            render: (amount) => <span className="font-bold text-green-600">+{amount}</span>,
        },
        {
            title: 'Price Paid',
            dataIndex: 'priceUsd',
            key: 'priceUsd',
            render: (price) => <span className="font-semibold">${price.toFixed(2)}</span>,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'completed' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
                    {status.toUpperCase()}
                </Tag>
            ),
        },
    ];

    const allHistory = historyData?.history || [];
    const purchases = allHistory.filter(item => item.amount > 0);
    const spendings = allHistory.filter(item => item.amount < 0);

    const storePurchasesList = purchaseData?.data || [];
    const storePagination = purchaseData?.pagination || {};

    const tabItems = [
        {
            key: '1',
            label: 'Store Purchase History',
            children: (
                <Table
                    dataSource={storePurchasesList}
                    columns={storePurchaseColumns}
                    rowKey="id"
                    loading={purchaseLoading}
                    pagination={{
                        current: page,
                        pageSize: limit,
                        total: storePagination.total,
                        onChange: (newPage, newLimit) => {
                            setPage(newPage);
                            setLimit(newLimit);
                        }
                    }}
                    locale={{ emptyText: "No store purchases found." }}
                />
            ),
        },
        {
            key: '3',
            label: 'Event Spendings Logs',
            children: (
                <Table
                    dataSource={spendings}
                    columns={logColumns}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: "No recent event spendings found." }}
                />
            ),
        },
    ];

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div>
                <Title level={2} className="!mb-2">Billing History</Title>
                <Text className="text-gray-500 text-lg">View your available credits and transaction history.</Text>
            </div>

            <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl border-none shadow-lg">
                <div className="p-4 flex flex-col md:flex-row items-center justify-between text-white">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <ThunderboltOutlined className="text-3xl text-yellow-400" />
                        </div>
                        <div>
                            <div className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Available Credits</div>
                            <div className="text-4xl font-bold">{credits}</div>
                        </div>
                    </div>
                    <div className="text-center md:text-right text-blue-100 text-sm max-w-sm">
                        Credits are used to launch events. Small events cost 10 credits, medium 25, and large 50.
                    </div>
                </div>
            </Card>

            <Card className="rounded-xl shadow-sm border-gray-200">
                <Tabs defaultActiveKey="1" items={tabItems} />
            </Card>
        </div>
    );
}

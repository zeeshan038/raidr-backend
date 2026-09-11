import { Card, Typography, Table, Tag, Button, Spin, Avatar, Space, Row, Col, Statistic, Divider, List } from 'antd';
import { ArrowLeftOutlined, UserOutlined, CalendarOutlined, EnvironmentOutlined, GiftOutlined, TrophyOutlined, InboxOutlined, CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGetEventByIdQuery, useGetMyCoinRushEventsQuery } from '../api/eventsApi';
import { QRCodeSVG } from 'qrcode.react';

const { Title, Text, Paragraph } = Typography;

export default function EventDetails() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const isCoinRush = searchParams.get('coinRush') === 'true';

    // Normal Event Query
    const { data: eventData, isLoading: isNormalLoading } = useGetEventByIdQuery(id, {
        skip: isCoinRush
    });

    // Coin Rush Events Query
    const { data: coinRushData, isLoading: isCoinRushLoading } = useGetMyCoinRushEventsQuery(undefined, {
        skip: !isCoinRush
    });

    const isLoading = isCoinRush ? isCoinRushLoading : isNormalLoading;

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
    }

    const event = isCoinRush
        ? coinRushData?.events?.find(e => e.id === id)
        : eventData?.event;

    if (!event) {
        return <div className="p-8 text-center text-gray-500">Event not found.</div>;
    }

    const getStatusColor = (status) => {
        const lowerStatus = (status || '').toLowerCase();
        if (lowerStatus === 'live') return 'green';
        if (lowerStatus === 'draft') return 'default';
        if (lowerStatus === 'scheduled') return 'cyan';
        if (lowerStatus === 'completed') return 'purple';
        if (lowerStatus === 'cancelled') return 'red';
        if (lowerStatus === 'pending_approval') return 'orange';
        return 'geekblue';
    };

    const normalClaimsColumns = [
        {
            title: 'User',
            key: 'user',
            render: (_, record) => (
                <Space>
                    <Avatar src={record.user?.photoUrl} icon={<UserOutlined />} />
                    <div>
                        <div className="font-medium">{record.user?.name || 'Unknown User'}</div>
                        <div className="text-xs text-gray-500">{record.user?.email || 'No email provided'}</div>
                    </div>
                </Space>
            )
        },
        {
            title: 'Claimed At',
            dataIndex: 'claimedAt',
            key: 'claimedAt',
            render: (date) => new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        },
        {
            title: 'Assigned Coupon / Code',
            dataIndex: 'code',
            key: 'code',
            render: (code) => <Text copyable strong className="text-blue-600">{code || 'N/A'}</Text>
        }
    ];

    const coinRushClaimsColumns = [
        {
            title: 'User (Winner)',
            key: 'user',
            render: (_, record) => (
                <Space>
                    <Avatar src={record.user?.photoUrl} icon={<UserOutlined />} />
                    <div>
                        <div className="font-medium">{record.user?.name || 'Unknown User'}</div>
                        <div className="text-xs text-gray-500">{record.user?.email || 'No email provided'}</div>
                    </div>
                </Space>
            )
        },
        {
            title: 'Claimed At',
            dataIndex: 'claimedAt',
            key: 'claimedAt',
            render: (date) => new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        },
        {
            title: 'Voucher Code',
            dataIndex: 'code',
            key: 'code',
            render: (code) => <Text copyable strong className="text-purple-600">{code || 'N/A'}</Text>
        }
    ];

    const handlePrintAllQRCodes = () => {
        const printWindow = window.open('', '_blank');
        let qrBlocksHtml = '';

        event.checkpoints.filter(cp => event.eventType === 'QR' || cp.type === 'QR').forEach(cp => {
            const svgElement = document.getElementById(`qr-svg-${cp.id}`);
            const svgHtml = svgElement?.outerHTML || '';
            qrBlocksHtml += `
                <div class="qr-card">
                    <h2>Checkpoint ${cp.sequence}</h2>
                    <p class="desc">${cp.description || `Scan to complete checkpoint ${cp.sequence}`}</p>
                    <div class="qr-wrapper">${svgHtml}</div>
                    <div class="code-val">Token: ${cp.qrCode}</div>
                </div>
            `;
        });

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print QR Codes - ${event.title}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
                        .qr-card { background: white; border: 2px dashed #e5e7eb; border-radius: 16px; padding: 20px; text-align: center; page-break-inside: avoid; }
                        h2 { margin: 0 0 4px 0; font-size: 20px; color: #111827; }
                        .desc { color: #4b5563; font-size: 13px; margin: 0 0 16px 0; }
                        .qr-wrapper { display: inline-block; padding: 12px; background: white; border: 1px solid #f3f4f6; border-radius: 12px; }
                        .code-val { margin-top: 12px; font-family: monospace; font-size: 10px; color: #9ca3af; }
                        @media print {
                            body { background: white; padding: 0; }
                            .qr-card { border: 1px solid #d1d5db; margin-bottom: 20px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${event.title} - QR Checkpoints</h1>
                        <p>Print and distribute these checkpoints physically inside your building</p>
                    </div>
                    <div class="grid">
                        ${qrBlocksHtml}
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="w-full space-y-6 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/events')} type="text" className="bg-white hover:bg-gray-50 shadow-sm border border-gray-200" />
                    <Title level={2} className="!m-0">{event.title}</Title>
                    <Tag color={getStatusColor(event.status)} className="ml-2 text-sm px-3 py-1 rounded-full font-medium border-0">
                        {event.status.replace('_', ' ').toUpperCase()}
                    </Tag>
                    {isCoinRush && <Tag color="purple" className="text-sm px-3 py-1 rounded-full font-medium border-0">COIN RUSH ({event.eventType})</Tag>}
                </div>
            </div>

            {event.rewardImageUrl && (
                <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden shadow-sm mb-6 relative group">
                    <img src={event.rewardImageUrl || event.imageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                        <Title level={3} className="!text-white !mb-2 drop-shadow-md">{event.title}</Title>
                        <div className="flex flex-wrap gap-4 text-white/90 text-sm drop-shadow-md">
                            {event.startTime && <span className="flex items-center gap-1.5"><CalendarOutlined /> {new Date(event.startTime).toLocaleDateString()}</span>}
                            {!isCoinRush && event.address && <span className="flex items-center gap-1.5"><EnvironmentOutlined /> {event.address?.split(',')[0]}</span>}
                        </div>
                    </div>
                </div>
            )}

            <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                    <div className="space-y-6">
                        <Card className="shadow-sm rounded-2xl border-gray-100 hover:shadow-md transition-shadow duration-300" bodyStyle={{ padding: '32px' }}>
                            <Title level={4} className="!mb-6 text-gray-800">About this Event</Title>
                            <Paragraph className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
                                {event.description}
                            </Paragraph>

                            <Divider className="my-8 opacity-60" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <Text className="text-gray-500 flex items-center gap-2 mb-3 font-medium uppercase text-xs tracking-wider"><CalendarOutlined /> Schedule</Text>
                                    <div className="font-medium text-gray-800 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="text-blue-600 mb-1">{new Date(event.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                        <div className="text-gray-400 text-sm my-1 pl-2 border-l-2 border-gray-200 ml-1">until</div>
                                        <div className="text-blue-600 mt-1">{new Date(event.endTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                    </div>
                                </div>
                                {!isCoinRush && (
                                    <div>
                                        <Text className="text-gray-500 flex items-center gap-2 mb-3 font-medium uppercase text-xs tracking-wider"><EnvironmentOutlined /> Location</Text>
                                        <div className="font-medium text-gray-800 bg-gray-50 p-4 rounded-xl border border-gray-100 h-[calc(100%-28px)]">
                                            {event.address || 'No address specified'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {isCoinRush && (
                            <Card 
                                className="shadow-sm rounded-2xl border-gray-100"
                                title={<div className="flex justify-between items-center"><span className="text-lg font-bold text-gray-800">Event Checkpoints</span>{(event.eventType === 'QR' || event.eventType === 'HYBRID') && <Button icon={<DownloadOutlined />} type="primary" onClick={handlePrintAllQRCodes}>Print QR Codes</Button>}</div>}
                            >
                                <List
                                    itemLayout="horizontal"
                                    dataSource={event.checkpoints || []}
                                    renderItem={(cp) => (
                                        <List.Item>
                                            <List.Item.Meta
                                                avatar={<Avatar className="bg-purple-100 text-purple-600 font-bold">{cp.sequence}</Avatar>}
                                                title={<span className="font-semibold text-gray-800">{cp.description || `Checkpoint ${cp.sequence}`}</span>}
                                                description={
                                                    (event.eventType === 'GPS' || cp.type === 'GPS') ? (
                                                        <div className="text-xs text-gray-500">
                                                            <EnvironmentOutlined className="mr-1" />
                                                            Coordinates: {cp.latitude?.toFixed(6)}, {cp.longitude?.toFixed(6)}
                                                        </div>
                                                    ) : (event.eventType === 'QR' || cp.type === 'QR') ? (
                                                        <div className="text-xs text-gray-400 font-mono">
                                                            QR Token: {cp.qrCode}
                                                        </div>
                                                    ) : (cp.type === 'CODE' || cp.type === 'SECRET_CODE') ? (
                                                        <div className="text-xs text-orange-500 font-mono">
                                                            Secret Code: {cp.secretCode}
                                                        </div>
                                                    ) : (cp.type === 'QA' || cp.type === 'QNA') ? (
                                                        <div className="text-xs text-cyan-600">
                                                            A: {cp.answer}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-500">
                                                            {cp.type} Checkpoint
                                                        </div>
                                                    )
                                                }
                                            />
                                            {(event.eventType === 'QR' || cp.type === 'QR') && (
                                                <div className="flex items-center gap-4">
                                                    <div className="hidden">
                                                        <QRCodeSVG id={`qr-svg-${cp.id}`} value={cp.qrCode} size={150} level="H" />
                                                    </div>
                                                    <QRCodeSVG value={cp.qrCode} size={60} level="H" />
                                                </div>
                                            )}
                                        </List.Item>
                                    )}
                                />
                            </Card>
                        )}
                    </div>
                </Col>

                <Col xs={24} lg={8}>
                    <div className="space-y-6">
                        {/* Normal Event Reward QR Code (Only for non-Coin Rush events) */}
                        {!isCoinRush && event.qrCode && (
                            <Card className="shadow-sm rounded-2xl border-gray-100 text-center hover:shadow-md transition-shadow duration-300">
                                <Text className="text-gray-700 uppercase tracking-wider text-xs font-bold block mb-4">Event Reward QR Code</Text>
                                <div className="bg-white p-4 rounded-2xl inline-block border border-gray-200 shadow-inner">
                                    <QRCodeSVG id="event-qr-svg" value={event.qrCode} size={180} level="H" />
                                </div>
                                <div className="mt-4">
                                    <Text type="secondary" className="text-xs block mb-3">
                                        Print and place this QR code at your cash counter for players to scan.
                                    </Text>
                                    <Button 
                                        type="primary" 
                                        onClick={() => {
                                            const printWindow = window.open('', '_blank');
                                            const svgHtml = document.getElementById('event-qr-svg')?.outerHTML || '';
                                            printWindow.document.write(`
                                                <html>
                                                    <head>
                                                        <title>Print QR Code - ${event.title}</title>
                                                        <style>
                                                            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; color: #1f2937; }
                                                            .container { border: 2px dashed #d1d5db; border-radius: 24px; padding: 40px; max-width: 400px; margin: 0 auto; }
                                                            h1 { margin-bottom: 8px; font-size: 24px; }
                                                            p { color: #4b5563; font-size: 14px; margin-bottom: 24px; }
                                                            .qr-container { background: white; padding: 20px; display: inline-block; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                                                            .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        <div class="container">
                                                            <h1>${event.title}</h1>
                                                            <p>Scan this QR code in the Raidr App to claim your reward!</p>
                                                            <div class="qr-container">
                                                                ${svgHtml}
                                                            </div>
                                                            <div class="footer">Powered by Raidr</div>
                                                        </div>
                                                        <script>
                                                            window.onload = function() { window.print(); window.close(); }
                                                        </script>
                                                    </body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                        }}
                                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                                    >
                                        Print QR Code
                                    </Button>
                                </div>
                            </Card>
                        )}

                        <Card className="shadow-sm rounded-2xl border-gray-100 bg-gradient-to-br from-[#00F0FF]/10 to-[#5000FF]/5 hover:shadow-md transition-shadow duration-300">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                                    <GiftOutlined className="text-2xl text-[#00F0FF]" />
                                </div>
                                <div>
                                    <Text className="text-gray-500 uppercase tracking-wider text-xs font-bold">Reward</Text>
                                    <Title level={4} className="!m-0 !mt-1 text-gray-800">{isCoinRush ? event.rewardTitle : event.reward}</Title>
                                    <Tag color={isCoinRush ? "purple" : "cyan"} className="mt-2 border-0 font-medium">
                                        {isCoinRush ? `Type: ${event.rewardType}` : `Size: ${event.size.toUpperCase()}`}
                                    </Tag>
                                </div>
                            </div>
                        </Card>

                        <Card className="shadow-sm rounded-2xl border-gray-100 hover:shadow-md transition-shadow duration-300">
                            <Row gutter={[16, 24]}>
                                <Col span={12}>
                                    <Statistic 
                                        title={<span className="text-gray-500 flex items-center gap-1.5"><UserOutlined /> Players Joined</span>} 
                                        value={event.totalParticipants || 0} 
                                        valueStyle={{ color: '#1f2937', fontWeight: 600 }}
                                    />
                                </Col>
                                {!isCoinRush ? (
                                    <Col span={12}>
                                        <Statistic 
                                            title={<span className="text-gray-500 flex items-center gap-1.5"><TrophyOutlined /> XP Reward</span>} 
                                            value={event.xpReward} 
                                            valueStyle={{ color: '#1f2937', fontWeight: 600 }}
                                        />
                                    </Col>
                                ) : (
                                    <Col span={12}>
                                        <Statistic 
                                            title={<span className="text-gray-500 flex items-center gap-1.5"><CheckCircleOutlined /> Checkpoints</span>} 
                                            value={event.checkpointCount} 
                                            valueStyle={{ color: '#1f2937', fontWeight: 600 }}
                                        />
                                    </Col>
                                )}
                                {!isCoinRush && (
                                    <Col span={24}>
                                        <Divider className="my-2 opacity-60" />
                                        <div className="flex justify-between items-center mt-2 bg-orange-50 p-3 rounded-xl border border-orange-100">
                                            <Text className="text-orange-800 font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                                Remaining Stock
                                            </Text>
                                            <Text className="text-xl font-bold text-orange-600">{event.remainingQty}</Text>
                                        </div>
                                    </Col>
                                )}
                            </Row>
                        </Card>
                    </div>
                </Col>
            </Row>

            <Card className="shadow-sm rounded-2xl border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 mt-6" 
                  title={<span className="text-lg font-bold text-gray-800 flex items-center gap-2">{isCoinRush ? 'Winner / Claims' : 'Claimed Rewards'} <Tag className="m-0 bg-blue-50 text-blue-600 border-0 rounded-full px-3">{event.claims?.length || 0}</Tag></span>}>
                <Table 
                    columns={isCoinRush ? coinRushClaimsColumns : normalClaimsColumns} 
                    dataSource={event.claims || []} 
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No claims yet.' }}
                    className="border-t border-gray-50"
                />
            </Card>
        </div>
    );
}

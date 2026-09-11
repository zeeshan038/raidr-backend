import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { compaignApi } from '../api/compaign';
import { useDispatch } from 'react-redux';
import { Spin, Button, Tag, Divider, Card, Input, Table, Typography } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, GlobalOutlined, InfoCircleOutlined, PictureOutlined, ProfileOutlined, EyeOutlined, GiftOutlined, UnlockOutlined, BarcodeOutlined } from '@ant-design/icons';

const SpecificCompaign = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchText);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchText]);

    useEffect(() => {
        const fetchCampaign = async () => {
            setLoading(true);
            try {
                const data = await dispatch(compaignApi.endpoints.getCampaignById.initiate({ id, search: debouncedSearch })).unwrap();
                setCampaign(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCampaign();
    }, [id, debouncedSearch, dispatch]);

    useEffect(() => {
        if (!campaign || !mapRef.current) return;

        const initMap = () => {
            const position = { 
                lat: parseFloat(campaign.latitude) || 0, 
                lng: parseFloat(campaign.longitude) || 0 
            };
            
            const map = new window.google.maps.Map(mapRef.current, {
                center: position,
                zoom: campaign.adCategory === 'geo campaign' ? 12 : 15,
                mapTypeControl: false,
                streetViewControl: false,
                styles: [
                    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                ]
            });

            const customMarkerSvg = `data:image/svg+xml;charset=UTF-8,` + encodeURIComponent(`
              <svg width="60" height="90" viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38BDF8" />
                    <stop offset="100%" stop-color="#A855F7" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <line x1="30" y1="45" x2="30" y2="75" stroke="#A855F7" stroke-width="3" />
                <circle cx="30" cy="75" r="6" fill="#A855F7" stroke="white" stroke-width="3" />
                <circle cx="30" cy="28" r="24" fill="url(#grad)" stroke="white" stroke-width="2" filter="url(#glow)"/>
                <path d="M21 24h18v11h-18zM21 20h18v3h-18zM30 20v15" stroke="white" stroke-width="2" stroke-linejoin="round" fill="none"/>
                <path d="M30 20c-2-2-6-1-6 1.5s4 2.5 6 0c2-2 6-1 6 1.5s-4 2.5-6 0z" stroke="white" stroke-width="2" fill="none"/>
              </svg>
            `);

            new window.google.maps.Marker({
                position,
                map,
                title: campaign.adTitle,
                icon: {
                    url: customMarkerSvg,
                    scaledSize: new window.google.maps.Size(40, 60),
                    anchor: new window.google.maps.Point(20, 60)
                }
            });

            if (campaign.adCategory === 'geo campaign' && campaign.radius) {
                new window.google.maps.Circle({
                    strokeColor: "#3B82F6",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#3B82F6",
                    fillOpacity: 0.2,
                    map,
                    center: position,
                    radius: campaign.radius * 1000,
                });
            }
        };

        if (!window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
            script.async = true;
            script.onload = initMap;
            document.head.appendChild(script);
        } else {
            initMap();
        }
    }, [campaign]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spin size="large" />
            </div>
        );
    }

    if (error || !campaign) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Campaign Not Found</h2>
                <Button type="primary" onClick={() => navigate('/campaigns')}>Back to Campaigns</Button>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[calc(100vh-64px)] py-6 space-y-6 flex flex-col">
            <div className="flex items-center justify-between">
                <Button 
                    type="text" 
                    icon={<ArrowLeftOutlined />} 
                    onClick={() => navigate('/campaigns')}
                    className="text-gray-500 hover:text-gray-900 font-medium"
                >
                    Back to Campaigns
                </Button>
                <Tag color={campaign.isActive !== false ? 'green' : 'red'} className="text-sm px-3 py-1">
                    {campaign.isActive !== false ? 'Active' : 'Paused'}
                </Tag>
            </div>

            {/* Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card bordered={false} className="shadow-sm rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xl">
                            <EyeOutlined />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium">Impressions</div>
                            <div className="text-2xl font-bold text-gray-900">{campaign.impressions || 0}</div>
                        </div>
                    </div>
                </Card>
                <Card bordered={false} className="shadow-sm rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 text-xl">
                            <UnlockOutlined />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium">Box Opens</div>
                            <div className="text-2xl font-bold text-gray-900">{campaign.boxOpens || 0}</div>
                        </div>
                    </div>
                </Card>
                <Card bordered={false} className="shadow-sm rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-xl">
                            <GiftOutlined />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium">Reward Claims</div>
                            <div className="text-2xl font-bold text-gray-900">{campaign.rewardClaims || 0}</div>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8">
                    <div className="flex items-start gap-6">
                        <img 
                            src={campaign.imageUrl || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=500&h=500&fit=crop'} 
                            alt={campaign.adTitle} 
                            className="w-32 h-32 rounded-xl object-cover border border-gray-100 shadow-sm"
                        />
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{campaign.adTitle || 'Unnamed Campaign'}</h1>
                            <div className="flex items-center gap-4 text-gray-500 text-sm mb-4">
                                <span className="flex items-center gap-1">
                                    <ProfileOutlined /> {campaign.adCategory === 'geo campaign' ? 'Geo Campaign' : 'Single Store Campaign'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <PictureOutlined /> Ad Type: <span className="capitalize">{campaign.adType || 'Text'}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <InfoCircleOutlined /> Category: <span className="capitalize">{campaign.placeCategory || 'Culinary'}</span>
                                </span>
                            </div>
                            <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
                                {campaign.descriptionText || 'No description provided.'}
                            </p>
                        </div>
                    </div>
                </div>

                <Divider className="m-0" />

                <div className="p-8 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <GlobalOutlined className="text-blue-500" /> Location & Map
                    </h3>

                    {/* Google Map Container */}
                    <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-sm border border-gray-200 mb-6 bg-gray-100" ref={mapRef}>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card bordered={false} className="shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Full Address</div>
                            <div className="font-medium text-gray-900 flex items-start gap-2">
                                <EnvironmentOutlined className="mt-1 text-red-500" />
                                <span>{campaign.address || 'Address not available'}</span>
                            </div>
                        </Card>
                        
                        <Card bordered={false} className="shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Coordinates & Region</div>
                            <div className="font-medium text-gray-900">
                                <div>{campaign.city || 'Unknown City'}, {campaign.country || 'Unknown Country'}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                    Lat: {campaign.latitude || 'N/A'}, Lng: {campaign.longitude || 'N/A'}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {campaign.adCategory === 'geo campaign' && (
                        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <GlobalOutlined />
                            </div>
                            <div>
                                <div className="font-bold text-blue-900">Geo Radius</div>
                                <div className="text-sm text-blue-700">This ad targets users within a {campaign.radius || 5} km radius.</div>
                            </div>
                        </div>
                    )}
                </div>

                <Divider className="m-0" />

                <div className="p-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <BarcodeOutlined className="text-purple-500" /> Coupon Codes
                        </h3>
                        <Input.Search 
                            placeholder="Search code..." 
                            allowClear 
                            onChange={(e) => setSearchText(e.target.value)} 
                            className="w-64"
                        />
                    </div>
                    <Table
                        dataSource={campaign.adCodes || []}
                        rowKey="id"
                        pagination={{ pageSize: 5 }}
                        columns={[
                            {
                                title: 'Coupon Code',
                                dataIndex: 'code',
                                key: 'code',
                                render: (text) => <Typography.Text copyable strong>{text}</Typography.Text>
                            },
                            {
                                title: 'Status',
                                dataIndex: 'isClaimed',
                                key: 'isClaimed',
                                render: (isClaimed) => (
                                    <Tag color={isClaimed ? 'red' : 'green'}>
                                        {isClaimed ? 'Claimed' : 'Available'}
                                    </Tag>
                                )
                            },
                            {
                                title: 'Created At',
                                dataIndex: 'createdAt',
                                key: 'createdAt',
                                render: (date) => new Date(date).toLocaleString()
                            }
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}

export default SpecificCompaign;
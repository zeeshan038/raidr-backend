import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, InputNumber, DatePicker, Button, Upload, Card, Typography, Row, Col, Divider, message, AutoComplete, Modal, Spin, Select } from 'antd';
import { UploadOutlined, ArrowLeftOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGetEventByIdQuery, useUpdateEventMutation, useGetMyCoinRushEventsQuery, useUpdateCoinRushMutation } from '../api/eventsApi';
import { useUploadImageMutation } from '../../../app/uploadApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function EditEvent() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const isCoinRush = searchParams.get('coinRush') === 'true';

    const [form] = Form.useForm();
    const [uploadImage] = useUploadImageMutation();
    const [updateEvent, { isLoading: isNormalUpdating }] = useUpdateEventMutation();
    const [updateCoinRush, { isLoading: isCoinRushUpdating }] = useUpdateCoinRushMutation();
    
    // Normal Event Query
    const { data: eventData, isLoading: isNormalLoading } = useGetEventByIdQuery(id, {
        skip: isCoinRush
    });

    // Coin Rush Query
    const { data: coinRushData, isLoading: isCoinRushLoading } = useGetMyCoinRushEventsQuery(undefined, {
        skip: !isCoinRush
    });

    const isEventLoading = isCoinRush ? isCoinRushLoading : isNormalLoading;
    const isLoading = isCoinRush ? isCoinRushUpdating : isNormalUpdating;
    const [uploading, setUploading] = useState(false);

    const [options, setOptions] = useState([]);
    const [locationData, setLocationData] = useState(null);
    const [isMapModalVisible, setIsMapModalVisible] = useState(false);
    const autocompleteService = useRef(null);
    const mapRef = useRef(null);
    const googleMap = useRef(null);
    const marker = useRef(null);

    const normFile = (e) => {
        if (Array.isArray(e)) {
            return e;
        }
        return e?.fileList;
    };

    useEffect(() => {
        if (!window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    useEffect(() => {
        if (isCoinRush && coinRushData?.events) {
            const coinRushEvent = coinRushData.events.find(e => e.id === id);
            if (coinRushEvent) {
                const { title, description, startTime, endTime, rewardTitle, rewardType, rewardValue, rewardDescription, rewardClaimInstructions, rewardImageUrl } = coinRushEvent;
                form.setFieldsValue({
                    title,
                    description,
                    eventDates: [dayjs(startTime), dayjs(endTime)],
                    rewardTitle,
                    rewardType,
                    rewardValue,
                    rewardDescription,
                    rewardClaimInstructions
                });

                if (rewardImageUrl) {
                    form.setFieldsValue({
                        eventImage: [{ uid: '-1', name: 'reward-image', status: 'done', url: rewardImageUrl }]
                    });
                }
            }
        } else if (!isCoinRush && eventData?.event) {
            const { title, description, address, latitude, longitude, startTime, endTime, reward, rewardQuantity, imageUrl, commanderAvatar } = eventData.event;
            
            form.setFieldsValue({
                title,
                description,
                address,
                latitude,
                longitude,
                eventDates: [dayjs(startTime), dayjs(endTime)],
                reward,
                quantity: rewardQuantity,
            });

            if (imageUrl) {
                form.setFieldsValue({
                    eventImage: [{ uid: '-1', name: 'event-image', status: 'done', url: imageUrl }]
                });
            }

            if (commanderAvatar) {
                form.setFieldsValue({
                    commanderAvatar: [{ uid: '-2', name: 'commander-avatar', status: 'done', url: commanderAvatar }]
                });
            }

            setLocationData({ latitude, longitude });
        }
    }, [eventData, coinRushData, isCoinRush, id, form]);

    const handleSearch = (value) => {
        if (!value) {
            setOptions([]);
            return;
        }

        if (!autocompleteService.current && window.google) {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();
        }
        if (autocompleteService.current) {
            autocompleteService.current.getPlacePredictions({ input: value }, (predictions, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setOptions(predictions.map((p) => ({ value: p.description, place_id: p.place_id })));
                } else {
                    setOptions([]);
                }
            });
        }
    };

    const handleSelect = (value, option) => {
        if (!window.google) return;
        const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
        placesService.getDetails({ placeId: option.place_id, fields: ['geometry', 'address_components', 'formatted_address'] }, (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                let latitude = 0;
                let longitude = 0;
                if (place.geometry && place.geometry.location) {
                    latitude = place.geometry.location.lat();
                    longitude = place.geometry.location.lng();
                }
                
                const address = place.formatted_address || value;
                form.setFieldsValue({ address, latitude, longitude });
                setLocationData({ latitude, longitude });
            }
        });
    };

    useEffect(() => {
        if (isMapModalVisible && window.google) {
            setTimeout(() => {
                if (!mapRef.current) return;
                const defaultLocation = { lat: 25.2048, lng: 55.2708 };
                let initialLocation = locationData?.latitude
                    ? { lat: locationData.latitude, lng: locationData.longitude }
                    : defaultLocation;

                googleMap.current = new window.google.maps.Map(mapRef.current, {
                    center: initialLocation,
                    zoom: 13,
                });

                marker.current = new window.google.maps.Marker({
                    position: initialLocation,
                    map: googleMap.current,
                    draggable: true,
                });

                window.google.maps.event.addListener(googleMap.current, 'click', (event) => {
                    marker.current.setPosition(event.latLng);
                });

                if (!locationData?.latitude && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const pos = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                            };
                            if (googleMap.current && marker.current) {
                                googleMap.current.setCenter(pos);
                                marker.current.setPosition(pos);
                            }
                        },
                        () => {}
                    );
                }
            }, 150);
        }
    }, [isMapModalVisible, locationData]);

    const handleConfirmMapLocation = () => {
        if (marker.current && window.google) {
            const position = marker.current.getPosition();
            const lat = position.lat();
            const lng = position.lng();

            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === "OK" && results[0]) {
                    const address = results[0].formatted_address;
                    form.setFieldsValue({ address, latitude: lat, longitude: lng });
                    setLocationData({ latitude: lat, longitude: lng });
                    setIsMapModalVisible(false);
                } else {
                    message.error("Could not determine address for this location.");
                }
            });
        }
    };

    const onFinish = async (values) => {
        setUploading(true);
        try {
            let imageUrl = '';
            let commanderAvatarUrl = null;

            if (values.eventImage && values.eventImage.length > 0) {
                imageUrl = values.eventImage[0].response?.url || values.eventImage[0].url || '';
            }

            if (values.commanderAvatar && values.commanderAvatar.length > 0) {
                commanderAvatarUrl = values.commanderAvatar[0].response?.url || values.commanderAvatar[0].url;
            }

            const startTime = values.eventDates[0].toISOString();
            const endTime = values.eventDates[1].toISOString();
            const duration = Math.round((values.eventDates[1].toDate() - values.eventDates[0].toDate()) / 60000);

            if (isCoinRush) {
                const payload = {
                    title: values.title,
                    description: values.description,
                    duration,
                    startTime,
                    endTime,
                    rewardType: values.rewardType,
                    rewardTitle: values.rewardTitle,
                    rewardValue: Number(values.rewardValue || 0),
                    rewardImageUrl: imageUrl,
                    rewardDescription: values.rewardDescription || '',
                    rewardClaimInstructions: values.rewardClaimInstructions || '',
                };

                await updateCoinRush({ eventId: id, eventData: payload }).unwrap();
                message.success('Coin Rush event updated successfully!');
            } else {
                const payload = {
                    title: values.title,
                    description: values.description,
                    address: values.address,
                    latitude: Number(values.latitude),
                    longitude: Number(values.longitude),
                    startTime,
                    endTime,
                    reward: values.reward,
                    rewardQuantity: Number(values.quantity),
                    ...(imageUrl && { imageUrl }),
                    ...(commanderAvatarUrl && { commanderAvatar: commanderAvatarUrl }),
                };

                await updateEvent({ eventId: id, eventData: payload }).unwrap();
                message.success('Event updated successfully!');
            }
            navigate('/events');
        } catch (error) {
            console.error('Failed to update event:', error);
            message.error(error.data?.msg || error.data?.message || 'Failed to update event. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    if (isEventLoading) {
        return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/events')} type="text" />
                <Title level={2} className="!m-0">Edit {isCoinRush ? 'Coin Rush' : 'Event'}</Title>
            </div>

            <Card className="shadow-sm rounded-xl border-gray-200">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                >
                    <Row gutter={24}>
                        <Col span={24}>
                            <Title level={5}>Event Details</Title>
                            <Divider className="my-3" />
                        </Col>
                        
                        <Col xs={24} md={24}>
                            <Form.Item name="title" label="Event Title" rules={[{ required: true, message: 'Please enter event title' }]}>
                                <Input placeholder="e.g. Free Pizza Raid" />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Form.Item name="description" label="Event Description" rules={[{ required: true }]}>
                                <TextArea rows={4} placeholder="Describe the event and how players can participate..." />
                            </Form.Item>
                        </Col>

                        {!isCoinRush && (
                            <Col span={24}>
                                <Form.Item name="address" label="Event Address" rules={[{ required: true, message: 'Please enter the address' }]}>
                                    <AutoComplete
                                        options={options}
                                        onSearch={handleSearch}
                                        onSelect={handleSelect}
                                        popupClassName="rounded-lg shadow-sm"
                                    >
                                        <Input
                                            placeholder="Exact Store Address"
                                            className="pr-12"
                                            suffix={
                                                <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => setIsMapModalVisible(true)}>
                                                    <EnvironmentOutlined className="text-[#00F0FF] text-lg" />
                                                    <span className="text-[10px] text-[#00F0FF] leading-none mt-0.5">Map</span>
                                                </div>
                                            }
                                        />
                                    </AutoComplete>
                                </Form.Item>
                            </Col>
                        )}

                        <Form.Item name="latitude" hidden>
                            <InputNumber />
                        </Form.Item>
                        <Form.Item name="longitude" hidden>
                            <InputNumber />
                        </Form.Item>

                        <Col xs={24} md={24}>
                            <Form.Item name="eventDates" label="Start & End Time" rules={[{ required: true }]}>
                                <DatePicker.RangePicker showTime={{ format: 'h:mm a', use12Hours: true }} format="YYYY-MM-DD h:mm a" className="w-full" />
                            </Form.Item>
                        </Col>
                        
                        <Col span={24}>
                            <Title level={5} className="mt-4">Rewards</Title>
                            <Divider className="my-3" />
                        </Col>

                        {isCoinRush ? (
                            <>
                                <Col xs={24} md={12}>
                                    <Form.Item name="rewardType" label="Reward Type" rules={[{ required: true }]}>
                                        <Select options={[
                                            { label: 'Digital Coupon', value: 'DIGITAL_COUPON' },
                                            { label: 'Cash Reward', value: 'CASH' },
                                            { label: 'Physical Prize', value: 'PHYSICAL' },
                                        ]} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item name="rewardTitle" label="Reward Title" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Free Coffee Coupon" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item name="rewardValue" label="Reward Value ($ / Units)" rules={[{ required: true }]}>
                                        <InputNumber min={0} className="w-full" placeholder="e.g. 5.00" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item name="rewardClaimInstructions" label="Claim Instructions">
                                        <Input placeholder="e.g. Show code to the receptionist" />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item name="rewardDescription" label="Reward Description">
                                        <TextArea rows={2} placeholder="Detail what the winner gets..." />
                                    </Form.Item>
                                </Col>
                            </>
                        ) : (
                            <>
                                <Col xs={24} md={12}>
                                    <Form.Item name="reward" label="Reward Name" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Free Pizza Voucher" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item name="quantity" label="Reward Quantity" rules={[{ required: true, message: 'Please enter reward quantity' }, { type: 'number', max: 500, message: 'Maximum 500 rewards allowed' }]}>
                                        <InputNumber min={1} max={500} className="w-full" placeholder="Number of rewards" />
                                    </Form.Item>
                                </Col>
                            </>
                        )}

                        <Col span={24}>
                            <Title level={5} className="mt-4">Media</Title>
                            <Divider className="my-3" />
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item name="eventImage" label={isCoinRush ? "Reward Image" : "Event/Reward Image"} valuePropName="fileList" getValueFromEvent={normFile}>
                                <Upload 
                                    listType="picture" 
                                    maxCount={1} 
                                    accept="image/*"
                                    customRequest={async ({ file, onSuccess, onError }) => {
                                        const formData = new FormData();
                                        formData.append('image', file);
                                        try {
                                            const uploadResponse = await uploadImage({ folder: 'eventReward', formData }).unwrap();
                                            if (uploadResponse && uploadResponse.url) {
                                                onSuccess(uploadResponse, file);
                                                message.success('Image uploaded instantly');
                                            } else {
                                                throw new Error('Upload failed');
                                            }
                                        } catch (error) {
                                            onError(error);
                                            message.error('Failed to upload image');
                                        }
                                    }}
                                >
                                    <Button icon={<UploadOutlined />}>Upload Event Image</Button>
                                </Upload>
                            </Form.Item>
                        </Col>
                        {!isCoinRush && (
                            <Col xs={24} md={12}>
                                <Form.Item name="commanderAvatar" label="Commander Avatar (Optional)" valuePropName="fileList" getValueFromEvent={normFile}>
                                    <Upload 
                                        listType="picture" 
                                        maxCount={1}
                                        accept="image/*"
                                        customRequest={async ({ file, onSuccess, onError }) => {
                                            const formData = new FormData();
                                            formData.append('image', file);
                                            try {
                                                const uploadResponse = await uploadImage({ folder: 'commander', formData }).unwrap();
                                                if (uploadResponse && uploadResponse.url) {
                                                    onSuccess(uploadResponse, file);
                                                    message.success('Avatar uploaded instantly');
                                                } else {
                                                    throw new Error('Upload failed');
                                                }
                                            } catch (error) {
                                                onError(error);
                                                message.error('Failed to upload avatar');
                                            }
                                        }}
                                    >
                                        <Button icon={<UploadOutlined />}>Upload Avatar</Button>
                                    </Upload>
                                    <div className="text-xs text-gray-500 mt-1">If empty, default business avatar will be used.</div>
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    <div className="mt-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-end gap-3">
                            <Button onClick={() => navigate('/events')} disabled={isLoading || uploading}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={isLoading || uploading}>Update Event</Button>
                        </div>
                    </div>
                </Form>
            </Card>

            <Modal
                title="Select Exact Location"
                open={isMapModalVisible}
                onCancel={() => setIsMapModalVisible(false)}
                onOk={handleConfirmMapLocation}
                width={600}
                okText="Confirm Location"
                centered
                zIndex={1050}
            >
                <div className="text-gray-500 mb-4 text-sm">Click on the map or drag the marker to select your exact location.</div>
                <div ref={mapRef} style={{ width: '100%', height: '400px', borderRadius: '8px' }}></div>
            </Modal>
        </div>
    );
}

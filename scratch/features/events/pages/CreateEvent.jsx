import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, InputNumber, DatePicker, Button, Upload, Card, Typography, Row, Col, Divider, message, Alert, Select, AutoComplete, Modal, Radio } from 'antd';
import { UploadOutlined, ArrowLeftOutlined, EnvironmentOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCreateEventMutation, useCreateCoinRushMutation, useCreateHybridCoinRushMutation } from '../api/eventsApi';
import { useUploadImageMutation } from '../../../app/uploadApi';
import HybridCheckpointList from './HybridCheckpointList';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function CreateEvent() {
    const navigate = useNavigate();
    const location = useLocation();
    const aiEventData = location.state?.aiEventData;
    
    const [form] = Form.useForm();
    const [uploadImage] = useUploadImageMutation();
    const [creditCost, setCreditCost] = useState(0);
    const [createEvent, { isLoading: isEventCreating }] = useCreateEventMutation();
    const [createCoinRush, { isLoading: isCoinRushCreating }] = useCreateCoinRushMutation();
    const [createHybridCoinRush, { isLoading: isHybridCoinRushCreating }] = useCreateHybridCoinRushMutation();
    const [uploading, setUploading] = useState(false);

    // Toggle Mode
    const [eventMode, setEventMode] = useState(aiEventData?.eventMode || 'normal'); 
    
    // Coin Rush specific state
    const [coinRushType, setCoinRushType] = useState('HYBRID');
    const [gpsMode, setGpsMode] = useState('auto'); 
    const [hybridCheckpoints, setHybridCheckpoints] = useState([]); 
    const [options, setOptions] = useState([]);
    const [locationData, setLocationData] = useState(null);
    const [isMapModalVisible, setIsMapModalVisible] = useState(false);
    const [mapSelectTarget, setMapSelectTarget] = useState('main');
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
        if (aiEventData) {
            if (aiEventData.eventMode === 'coin_rush') {
                setCoinRushType('HYBRID');
                setGpsMode(aiEventData.gpsMode || 'auto');
            }
            form.setFieldsValue({
                title: aiEventData.title,
                description: aiEventData.description,
                checkpointCount: aiEventData.checkpointCount,
                radiusMeter: aiEventData.radiusMeter,
                rewardType: aiEventData.rewardType,
                rewardTitle: aiEventData.rewardTitle,
                rewardValue: aiEventData.rewardValue,
                rewardDescription: aiEventData.rewardDescription,
                rewardClaimInstructions: aiEventData.rewardClaimInstructions,
                address: aiEventData.address,
                latitude: aiEventData.latitude,
                longitude: aiEventData.longitude,
            });
            
            if (aiEventData.latitude && aiEventData.longitude) {
                setLocationData({ latitude: aiEventData.latitude, longitude: aiEventData.longitude });
            }
        }
    }, [aiEventData, form]);

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
                let initialLocation = defaultLocation;

                if (mapSelectTarget === 'main' && locationData?.latitude) {
                    initialLocation = { lat: locationData.latitude, lng: locationData.longitude };
                } else if (typeof mapSelectTarget === 'number') {
                    const checkpoints = form.getFieldValue('checkpoints') || [];
                    const cp = checkpoints[mapSelectTarget];
                    if (cp && cp.latitude && cp.longitude) {
                        initialLocation = { lat: Number(cp.latitude), lng: Number(cp.longitude) };
                    } else if (locationData?.latitude) {
                        initialLocation = { lat: locationData.latitude, lng: locationData.longitude };
                    }
                } else if (locationData?.latitude) {
                    initialLocation = { lat: locationData.latitude, lng: locationData.longitude };
                }

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

                const needsGeolocation = (mapSelectTarget === 'main' && !locationData?.latitude) ||
                    (typeof mapSelectTarget === 'number' && (() => {
                        const checkpoints = form.getFieldValue('checkpoints') || [];
                        const cp = checkpoints[mapSelectTarget];
                        return !(cp && cp.latitude && cp.longitude) && !locationData?.latitude;
                    })());

                if (needsGeolocation && navigator.geolocation) {
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
    }, [isMapModalVisible, locationData, mapSelectTarget]);

    const handleConfirmMapLocation = () => {
        if (marker.current && window.google) {
            const position = marker.current.getPosition();
            const lat = position.lat();
            const lng = position.lng();

            if (mapSelectTarget === 'main') {
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
            } else if (typeof mapSelectTarget === 'number') {
                const checkpoints = form.getFieldValue('checkpoints') || [];
                const updated = [...checkpoints];
                if (!updated[mapSelectTarget]) {
                    updated[mapSelectTarget] = {};
                }
                updated[mapSelectTarget].latitude = Number(lat.toFixed(6));
                updated[mapSelectTarget].longitude = Number(lng.toFixed(6));
                
                form.setFieldsValue({ checkpoints: updated });
                setIsMapModalVisible(false);

                // Asynchronously update description if empty
                if (!updated[mapSelectTarget].description) {
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === "OK" && results[0]) {
                            const latest = form.getFieldValue('checkpoints') || [];
                            const next = [...latest];
                            if (next[mapSelectTarget] && !next[mapSelectTarget].description) {
                                next[mapSelectTarget].description = results[0].formatted_address;
                                form.setFieldsValue({ checkpoints: next });
                            }
                        }
                    });
                }
            } else if (typeof mapSelectTarget === 'string' && mapSelectTarget !== 'main') {
                setHybridCheckpoints(prev => prev.map(cp => {
                    if (cp.id === mapSelectTarget) {
                        return { ...cp, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
                    }
                    return cp;
                }));
                setIsMapModalVisible(false);

                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === "OK" && results[0]) {
                        setHybridCheckpoints(prev => prev.map(cp => {
                            if (cp.id === mapSelectTarget && !cp.description) {
                                return { ...cp, description: results[0].formatted_address };
                            }
                            return cp;
                        }));
                    }
                });
            }
        }
    };

    const onFinishFailed = (errorInfo) => {
        if (errorInfo.errorFields && errorInfo.errorFields.length > 0) {
            const firstError = errorInfo.errorFields[0].errors[0];
            message.error(`Validation Failed: ${firstError}`);
        } else {
            message.error('Please fill in all required fields correctly.');
        }
        console.log('Form Validation Failed:', errorInfo);
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

            if (eventMode === 'coin_rush') {
                const payload = {
                    title: values.title,
                    description: values.description,
                    eventType: coinRushType,
                    checkpointCount: Number(values.checkpointCount || 5),
                    duration,
                    startTime,
                    endTime,
                    rewardType: values.rewardType,
                    rewardTitle: values.rewardTitle,
                    rewardValue: Number(values.rewardValue || 0),
                    rewardImageUrl: imageUrl,
                    rewardDescription: values.rewardDescription || '',
                    rewardClaimInstructions: values.rewardClaimInstructions || '',
                    winnersCount: Number(values.winnersCount || 1),
                };

                if (coinRushType === 'GPS') {
                    if (gpsMode === 'auto') {
                        payload.centerLat = Number(values.latitude);
                        payload.centerLng = Number(values.longitude);
                        payload.radiusMeter = Number(values.radiusMeter || 500);
                    } else {
                        // Manual checkpoints
                        payload.checkpoints = (values.checkpoints || []).map(cp => ({
                            latitude: Number(cp.latitude),
                            longitude: Number(cp.longitude),
                            description: cp.description || ''
                        }));
                        payload.checkpointCount = payload.checkpoints.length;
                    }
                } else if (coinRushType === 'HYBRID') {
                    payload.checkpoints = hybridCheckpoints.map(cp => {
                        const { id, ...rest } = cp;
                        if (rest.type === 'GPS') {
                            rest.latitude = Number(rest.latitude);
                            rest.longitude = Number(rest.longitude);
                        }
                        return rest;
                    });
                    payload.checkpointCount = hybridCheckpoints.length;
                }

                if (coinRushType === 'HYBRID') {
                    await createHybridCoinRush(payload).unwrap();
                } else {
                    await createCoinRush(payload).unwrap();
                }
                
                message.success('Coin Rush event successfully created!');
            } else {
                let calculatedSize = 'small';
                if (values.quantity <= 25) calculatedSize = 'small';
                else if (values.quantity <= 100) calculatedSize = 'medium';
                else calculatedSize = 'large';

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
                    size: calculatedSize,
                    ...(imageUrl && { imageUrl }),
                    ...(commanderAvatarUrl && { commanderAvatar: commanderAvatarUrl }),
                };

                await createEvent(payload).unwrap();
                message.success('Event successfully submitted for approval!');
            }
            navigate('/events');
        } catch (error) {
            console.error('Failed to create event:', error);
            message.error(error.data?.msg || error.data?.message || 'Failed to create event. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleValuesChange = (changedValues, allValues) => {
        if (eventMode === 'normal') {
            if (allValues.quantity) {
                if (allValues.quantity <= 25) setCreditCost(10);
                else if (allValues.quantity <= 100) setCreditCost(25);
                else setCreditCost(50);
            } else {
                setCreditCost(0);
            }
        } else {
            // Coin Rush fixed credits or basic pricing
            setCreditCost(30);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/events')} type="text" />
                <Title level={2} className="!m-0">Create New Event</Title>
            </div>

            <Card className="shadow-sm rounded-xl border-gray-200">
                <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-150">
                    <Text className="text-gray-500 block mb-2 font-medium">Choose Event Mode:</Text>
                    <Radio.Group 
                        value={eventMode} 
                        onChange={(e) => { 
                            setEventMode(e.target.value); 
                            form.resetFields(); 
                        }}
                        buttonStyle="solid"
                        size="large"
                    >
                        <Radio.Button value="normal">Normal Raid (Standard Location Claim)</Radio.Button>
                        <Radio.Button value="coin_rush">Coin Rush (Race Through Checkpoints)</Radio.Button>
                    </Radio.Group>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    onFinishFailed={onFinishFailed}
                    onValuesChange={handleValuesChange}
                    initialValues={{
                        checkpointCount: 5,
                        radiusMeter: 500,
                        rewardType: 'DIGITAL_COUPON',
                        rewardValue: 0
                    }}
                >
                    <Row gutter={24}>
                        <Col span={24}>
                            <Title level={5}>Event Details</Title>
                            <Divider className="my-3" />
                        </Col>
                        
                        <Col xs={24} md={24}>
                            <Form.Item name="title" label="Event Title" rules={[{ required: true, message: 'Please enter event title' }]}>
                                <Input placeholder="e.g. Mall QR Hunt" />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Form.Item name="description" label="Event Description" rules={[{ required: true }]}>
                                <TextArea rows={4} placeholder="Describe the event and how players can participate..." />
                            </Form.Item>
                        </Col>

                        {/* Event Date Range Picker */}
                        <Col xs={24} md={24}>
                            <Form.Item name="eventDates" label="Start & End Time" rules={[{ required: true }]}>
                                <DatePicker.RangePicker showTime={{ format: 'h:mm a', use12Hours: true }} format="YYYY-MM-DD h:mm a" className="w-full" />
                            </Form.Item>
                        </Col>

                        {/* Normal / GPS Center Coordinates Fields */}
                        {(eventMode === 'normal' || (eventMode === 'coin_rush' && coinRushType === 'GPS' && gpsMode === 'auto') || (eventMode === 'coin_rush' && (coinRushType === 'QR' || coinRushType === 'HYBRID'))) && (
                            <Col span={24}>
                                <Form.Item 
                                    name="address" 
                                    label={(eventMode === 'coin_rush' && (coinRushType === 'QR' || coinRushType === 'HYBRID')) ? "Starting Location / Address" : "Event Address"} 
                                    rules={[{ required: true, message: 'Please enter the address' }]}
                                >
                                    <AutoComplete
                                        options={options}
                                        onSearch={handleSearch}
                                        onSelect={handleSelect}
                                        popupClassName="rounded-lg shadow-sm"
                                    >
                                        <Input
                                            placeholder="Exact Location Address"
                                            className="pr-12"
                                            suffix={
                                                <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => { setMapSelectTarget('main'); setIsMapModalVisible(true); }}>
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

                        {/* COIN RUSH SPECIFIC CONTROLS */}
                        {eventMode === 'coin_rush' && (
                            <Col span={24} className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 mb-6">
                                <Title level={5} className="!m-0 text-blue-800">Coin Rush Settings</Title>
                                <Divider className="my-3 border-blue-150" />
                                
                                <Row gutter={24}>


                                    {coinRushType === 'GPS' ? (
                                        <>
                                            <Col xs={24} md={12}>
                                                <Form.Item label="Checkpoint Mode" required>
                                                    <Radio.Group 
                                                        value={gpsMode} 
                                                        onChange={(e) => setGpsMode(e.target.value)}
                                                        optionType="button"
                                                        buttonStyle="solid"
                                                    >
                                                        <Radio.Button value="auto">Auto-Generate</Radio.Button>
                                                        <Radio.Button value="manual">Manual Entry</Radio.Button>
                                                    </Radio.Group>
                                                </Form.Item>
                                            </Col>

                                            {gpsMode === 'auto' ? (
                                                <>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name="checkpointCount" label="Checkpoint Count" rules={[{ required: true }]}>
                                                            <InputNumber min={3} max={10} className="w-full" placeholder="e.g. 5 Checkpoints" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name="radiusMeter" label="Auto-generation Radius (meters)" rules={[{ required: true }]}>
                                                            <InputNumber min={50} max={2000} className="w-full" placeholder="e.g. 500 meters" />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            ) : (
                                                <Col span={24}>
                                                    <Text className="block mb-2 font-medium">Checkpoints List:</Text>
                                                    <Form.List name="checkpoints">
                                                        {(fields, { add, remove }) => (
                                                            <>
                                                                 {fields.map(({ key, name, ...restField }) => (
                                                                    <Row gutter={12} key={key} align="middle" className="mb-2">
                                                                        <Col span={6}>
                                                                            <Form.Item {...restField} name={[name, 'latitude']} rules={[{ required: true, message: 'Required' }]}>
                                                                                <InputNumber placeholder="Latitude" className="w-full" step="0.000001" precision={6} />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={6}>
                                                                            <Form.Item {...restField} name={[name, 'longitude']} rules={[{ required: true, message: 'Required' }]}>
                                                                                <InputNumber placeholder="Longitude" className="w-full" step="0.000001" precision={6} />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={8}>
                                                                            <Form.Item {...restField} name={[name, 'description']}>
                                                                                <Input placeholder="Description (e.g. Landmark)" />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={2} className="flex justify-center">
                                                                            <Button 
                                                                                type="text" 
                                                                                icon={<EnvironmentOutlined className="text-blue-500 text-lg" />} 
                                                                                onClick={() => {
                                                                                    setMapSelectTarget(name);
                                                                                    setIsMapModalVisible(true);
                                                                                }} 
                                                                                title="Select on Map"
                                                                                style={{ marginBottom: '24px' }}
                                                                            />
                                                                        </Col>
                                                                        <Col span={2} className="flex justify-center">
                                                                            <Button 
                                                                                type="text" 
                                                                                danger 
                                                                                onClick={() => remove(name)} 
                                                                                icon={<DeleteOutlined />} 
                                                                                style={{ marginBottom: '24px' }}
                                                                            />
                                                                        </Col>
                                                                    </Row>
                                                                ))}
                                                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} className="mt-2">
                                                                    Add Checkpoint Coordinate
                                                                </Button>
                                                            </>
                                                        )}
                                                    </Form.List>
                                                </Col>
                                            )}
                                        </>
                                    ) : coinRushType === 'QR' ? (
                                        <Col xs={24} md={12}>
                                            <Form.Item name="checkpointCount" label="Checkpoint (QR Code) Count" rules={[{ required: true }]}>
                                                <InputNumber min={3} max={10} className="w-full" placeholder="Number of QR Codes to generate" />
                                            </Form.Item>
                                        </Col>
                                    ) : (
                                        <Col span={24}>
                                            <Text className="block mb-2 font-medium">Hybrid Checkpoints List:</Text>
                                            <HybridCheckpointList 
                                                checkpoints={hybridCheckpoints} 
                                                setCheckpoints={setHybridCheckpoints}
                                                onMapSelect={(id) => {
                                                    setMapSelectTarget(id);
                                                    setIsMapModalVisible(true);
                                                }}
                                            />
                                        </Col>
                                    )}
                                </Row>
                            </Col>
                        )}
                        
                        <Col span={24}>
                            <Title level={5} className="mt-4">Rewards</Title>
                            <Divider className="my-3" />
                        </Col>

                        {eventMode === 'coin_rush' ? (
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
                                    <Form.Item name="winnersCount" label="Number of Winners (Prizes)" rules={[{ required: true }]} initialValue={1}>
                                        <InputNumber min={1} max={5} className="w-full" placeholder="e.g. 3" />
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
                            <Form.Item name="eventImage" label={eventMode === 'coin_rush' ? "Reward Image" : "Event/Reward Image"} valuePropName="fileList" getValueFromEvent={normFile}>
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
                        {eventMode === 'normal' && (
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
                        <div className="flex justify-between items-center mb-4">
                            <Text strong>Estimated Credit Cost:</Text>
                            <Text className="text-lg font-bold text-blue-600">{creditCost} Credits</Text>
                        </div>
                        <Alert 
                            message="Credits are consumed upon event submission. Ensure you have enough balance." 
                            type="info" 
                            showIcon 
                            className="mb-4"
                        />
                        <div className="flex justify-end gap-3">
                            <Button onClick={() => navigate('/events')} disabled={isEventCreating || isCoinRushCreating || uploading}>Cancel</Button>
                            <Button type="primary" htmlType="submit" className="px-8" size="large" loading={isEventCreating || isCoinRushCreating || isHybridCoinRushCreating || uploading}>Submit Event</Button>
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

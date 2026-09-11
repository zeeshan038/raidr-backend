import React, { useState } from 'react';
import { Typography, Card, Row, Col, Button, Badge, Modal } from 'antd';
import { CheckCircleOutlined, CreditCardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '../components/CheckoutForm';

const { Title, Text } = Typography;

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_placeholder');

export default function Payments() {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);

    const handleBuyClick = (pkg) => {
        setSelectedPackage(pkg);
        setIsModalVisible(true);
    };

    const handlePaymentSuccess = () => {
        setIsModalVisible(false);
        setSelectedPackage(null);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setSelectedPackage(null);
    };

    const creditPackages = [
        { id: 1, name: 'Starter Pack', credits: 50, price: '$10', description: 'Perfect for small events to test the waters.', popular: false },
        { id: 2, name: 'Growth Pack', credits: 150, price: '$25', description: 'Our most popular choice. Great for medium events.', popular: true },
        { id: 3, name: 'Enterprise Pack', credits: 500, price: '$75', description: 'For businesses hosting large-scale events.', popular: false }
    ];

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
            <div className="text-center mb-12">
                <Title level={1} className="!mb-4 !text-4xl font-extrabold text-gray-900 tracking-tight">Choose Your Plan</Title>
                <Text className="text-gray-500 text-xl max-w-2xl mx-auto block">Purchase credits to launch new exciting Raidr events and reward your customers.</Text>
            </div>
            
            <div className="w-full max-w-6xl">
                <Row gutter={[32, 32]} justify="center" align="middle">
                    {creditPackages.map((pkg) => (
                        <Col xs={24} md={8} key={pkg.id}>
                            <Badge.Ribbon text={pkg.popular ? "Most Popular" : ""} color={pkg.popular ? "blue" : "transparent"} className={pkg.popular ? "mt-[-4px] mr-[-4px] text-sm font-bold px-3 py-1" : "hidden"}>
                                <Card 
                                    className={`h-full rounded-[2rem] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${pkg.popular ? 'border-blue-500 border-2 shadow-xl scale-105 z-10 relative bg-white' : 'border-gray-100 shadow-lg bg-gray-50/50'}`}
                                    bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '48px 32px' }}
                                >
                                    <div className="text-center mb-8">
                                        <Title level={3} className="!mb-3 font-bold">{pkg.name}</Title>
                                        <Text className="text-gray-500 text-base">{pkg.description}</Text>
                                    </div>
                                    
                                    <div className="text-center mb-10 flex-grow">
                                        <div className="flex items-center justify-center gap-2 mb-4">
                                            <span className="text-6xl font-black text-gray-900 tracking-tighter">{pkg.credits}</span>
                                            <span className="text-xl font-bold text-blue-600">Credits</span>
                                        </div>
                                        <div className="text-3xl font-extrabold text-gray-400">{pkg.price}</div>
                                    </div>

                                    <ul className="space-y-4 mb-10">
                                        <li className="flex items-center gap-3 text-gray-700 font-medium">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircleOutlined className="text-blue-600 text-sm" />
                                            </div>
                                            Instant availability
                                        </li>
                                        <li className="flex items-center gap-3 text-gray-700 font-medium">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircleOutlined className="text-blue-600 text-sm" />
                                            </div>
                                            Never expires
                                        </li>
                                    </ul>

                                    <Button 
                                        type={pkg.popular ? "primary" : "default"} 
                                        size="large" 
                                        block 
                                        className={`rounded-2xl h-14 font-bold text-lg border-2 transition-all ${pkg.popular ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 shadow-lg shadow-blue-200' : 'text-gray-700 border-gray-200 hover:border-blue-500 hover:text-blue-600 bg-white'}`}
                                        icon={<CreditCardOutlined />}
                                        onClick={() => handleBuyClick(pkg)}
                                    >
                                        Buy Now
                                    </Button>
                                </Card>
                            </Badge.Ribbon>
                        </Col>
                    ))}
                </Row>
            </div>

            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SafetyCertificateOutlined className="text-blue-600 text-xl" />
                        <span className="text-xl font-bold">Secure Checkout</span>
                    </div>
                }
                open={isModalVisible}
                footer={null}
                onCancel={handleCancel}
                destroyOnClose
            >
                {selectedPackage && (
                    <Elements 
                        stripe={stripePromise} 
                        options={{ 
                            mode: 'payment',
                            amount: Number(selectedPackage.price.replace('$', '')) * 100,
                            currency: 'usd',
                            appearance: { theme: 'stripe' } 
                        }}
                    >
                        <CheckoutForm 
                            selectedPackage={selectedPackage}
                            onSuccess={handlePaymentSuccess} 
                            onCancel={handleCancel} 
                        />
                    </Elements>
                )}
            </Modal>
        </div>
    );
}

import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button, message, Alert, Form, Input, Row, Col } from 'antd';
import { useCreatePaymentIntentMutation } from '../api/paymentApi';

export default function CheckoutForm({ selectedPackage, onSuccess, onCancel }) {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [createPaymentIntent] = useCreatePaymentIntentMutation();

    const handleFinish = async (values) => {
        if (!stripe || !elements) return;

        setIsLoading(true);
        setErrorMessage(null);

        try {
            // Trigger form validation and wallet collection
            const { error: submitError } = await elements.submit();
            if (submitError) {
                setErrorMessage(submitError.message);
                setIsLoading(false);
                return;
            }

            // 1. Create PaymentIntent on backend with address
            const priceUsd = Number(selectedPackage.price.replace('$', ''));
            const response = await createPaymentIntent({
                coinsAmount: selectedPackage.credits,
                priceUsd: priceUsd,
                address: {
                    line1: values.line1,
                    city: values.city,
                    state: values.state,
                    country: values.country,
                    postal_code: values.postal_code
                }
            }).unwrap();

            if (!response.clientSecret) {
                throw new Error("Failed to get client secret");
            }

            // 2. Confirm payment with Stripe using the returned clientSecret
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret: response.clientSecret,
                confirmParams: {
                    return_url: window.location.origin + '/payments',
                },
                redirect: 'if_required',
            });

            if (error) {
                setErrorMessage(error.message);
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                message.success('Payment successful!');
                if (onSuccess) onSuccess();
            } else {
                setErrorMessage('An unexpected error occurred.');
            }
        } catch (error) {
            console.error(error);
            setErrorMessage('Failed to process payment. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form layout="vertical" onFinish={handleFinish} className="mt-2">
            {errorMessage && <Alert type="error" message={errorMessage} showIcon className="mb-4" />}
            
            <div className="font-semibold text-base mb-3 text-gray-700">Payment Details</div>
            <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 mb-6 shadow-sm">
                <PaymentElement id="payment-element" />
            </div>

            <div className="font-semibold text-base mb-3 text-gray-700">Billing Address</div>
            <Form.Item name="line1" rules={[{ required: true, message: 'Street Address is required' }]} className="mb-3">
                <Input placeholder="123 Main Street" size="large" />
            </Form.Item>
            <Row gutter={12} className="mb-0">
                <Col span={12}>
                    <Form.Item name="city" rules={[{ required: true, message: 'City is required' }]} className="mb-3">
                        <Input placeholder="City" size="large" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="state" rules={[{ required: true, message: 'State is required' }]} className="mb-3">
                        <Input placeholder="State (e.g. MH)" size="large" />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={12} className="mb-0">
                <Col span={12}>
                    <Form.Item name="country" rules={[{ required: true, len: 2, message: 'Must be 2-letter code' }]} className="mb-3">
                        <Input placeholder="Country Code (IN)" maxLength={2} size="large" style={{ textTransform: 'uppercase' }} />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="postal_code" rules={[{ required: true, message: 'Postal Code is required' }]} className="mb-3">
                        <Input placeholder="Postal Code" size="large" />
                    </Form.Item>
                </Col>
            </Row>

            <div className="flex justify-end gap-3 pt-4">
                <Button onClick={onCancel} disabled={isLoading} size="large" className="rounded-lg">
                    Cancel
                </Button>
                <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={isLoading} 
                    disabled={!stripe || !elements}
                    size="large"
                    className="bg-blue-600 font-semibold rounded-lg px-8 shadow-md"
                >
                    Pay {selectedPackage?.price}
                </Button>
            </div>
        </Form>
    );
}

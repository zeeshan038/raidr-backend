import React from 'react';
import { Form, Input, Button, Typography, message, Select, AutoComplete } from 'antd';
import { MailOutlined, LockOutlined, ShopOutlined, UserOutlined, GiftOutlined, CompassOutlined, BarChartOutlined, EnvironmentOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useMerchantRegisterMutation } from '../api/auth';

const { Title, Text } = Typography;

const Register = () => {
    const navigate = useNavigate();
    const [registerMerchant, { isLoading }] = useMerchantRegisterMutation();

    const onFinish = async (values) => {
        try {
            await registerMerchant({
                email: values.email,
                password: values.password,
                businessName: values.businessName,
                name: values.fullName,
                category: values.category || "",
                address: values.address || "",
                phone: values.phone || "",
                defaultRadiusMeter: 300 
            }).unwrap();
            message.success('Account created successfully!');
            navigate('/login');
        } catch (error) {
            console.error('Registration error:', error);
            message.error(error?.data?.msg || error.message || 'Failed to create an account.');
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans">
            {/* Left Column - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 relative z-10 overflow-y-auto">
                <div className="max-w-md w-full mx-auto">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                        Create an account
                    </h1>
                    <p className="text-gray-500 mb-8 font-medium">
                        Join Raidr as a merchant partner
                    </p>

                    <Form
                        name="register"
                        onFinish={onFinish}
                        layout="vertical"
                        size="large"
                        scrollToFirstError
                        className="mt-6"
                    >
                        <div className="grid grid-cols-1 gap-x-4">
                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Business Name</div>
                            <Form.Item
                                name="businessName"
                                rules={[{ required: true, message: 'Please input your business name!', whitespace: true }]}
                                className="mb-5"
                            >
                                <Input 
                                    prefix={<ShopOutlined className="text-gray-400 mr-2" />} 
                                    placeholder="Your Business Name" 
                                    className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors"
                                />
                            </Form.Item>

                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Owner Full Name</div>
                            <Form.Item
                                name="fullName"
                                rules={[{ required: true, message: 'Please input your full name!', whitespace: true }]}
                                className="mb-5"
                            >
                                <Input 
                                    prefix={<UserOutlined className="text-gray-400 mr-2" />} 
                                    placeholder="John Doe" 
                                    className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors"
                                />
                            </Form.Item>

                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Category</div>
                            <Form.Item
                                name="category"
                                initialValue="Other"
                                rules={[{ required: true, message: 'Please select or type a category!' }]}
                                className="mb-5"
                            >
                                <AutoComplete
                                    options={[
                                        { value: 'Other', label: 'Other' },
                                        { value: 'Food & Beverage', label: 'Food & Beverage' },
                                        { value: 'Retail', label: 'Retail' },
                                        { value: 'Entertainment', label: 'Entertainment' },
                                        { value: 'Services', label: 'Services' }
                                    ]}
                                    filterOption={(inputValue, option) =>
                                        option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                    popupClassName="rounded-xl"
                                >
                                    <Input 
                                        size="large"
                                        prefix={<AppstoreOutlined className="text-gray-400 mr-2" />} 
                                        placeholder="Type or select a category" 
                                        className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors w-full h-12"
                                    />
                                </AutoComplete>
                            </Form.Item>

                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Address</div>
                            <Form.Item
                                name="address"
                                rules={[{ required: true, message: 'Please input your address!', whitespace: true }]}
                                className="mb-5"
                            >
                                <Input 
                                    prefix={<EnvironmentOutlined className="text-gray-400 mr-2" />} 
                                    placeholder="Address" 
                                    className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors"
                                />
                            </Form.Item>

                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Email</div>
                            <Form.Item
                                name="email"
                                rules={[
                                    { type: 'email', message: 'The input is not valid E-mail!' },
                                    { required: true, message: 'Please input your E-mail!' },
                                ]}
                                className="mb-5"
                            >
                                <Input 
                                    prefix={<MailOutlined className="text-gray-400 mr-2" />} 
                                    placeholder="your-email@example.com" 
                                    className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors"
                                />
                            </Form.Item>

                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Password</div>
                            <Form.Item
                                name="password"
                                rules={[
                                    { required: true, message: 'Please input your password!' },
                                    { min: 6, message: 'Password must be at least 6 characters long!' }
                                ]}
                                hasFeedback
                                className="mb-5"
                            >
                                <Input.Password 
                                    prefix={<LockOutlined className="text-gray-400 mr-2" />} 
                                    placeholder="••••••••••••" 
                                    className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors"
                                />
                            </Form.Item>

                            <div className="mb-1 text-xs font-bold tracking-widest text-gray-500 uppercase">Confirm Password</div>
                            <Form.Item
                                name="confirm"
                                dependencies={['password']}
                                hasFeedback
                                rules={[
                                    { required: true, message: 'Please confirm your password!' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('password') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('The new password that you entered do not match!'));
                                        },
                                    }),
                                ]}
                                className="mb-8"
                            >
                                <Input.Password 
                                    prefix={<LockOutlined className="text-gray-400 mr-2" />} 
                                    placeholder="••••••••••••" 
                                    className="bg-white hover:bg-gray-50 focus:bg-white border-gray-200 hover:border-[#4F46E5] focus:border-[#4F46E5] text-gray-900 rounded-xl py-3 px-4 transition-colors"
                                />
                            </Form.Item>
                        </div>

                        <Form.Item>
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                loading={isLoading} 
                                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] border-none rounded-xl font-bold py-6 text-base shadow-lg shadow-indigo-500/20"
                            >
                                Register
                            </Button>
                        </Form.Item>

                        <div className="text-left mt-8">
                            <span className="text-gray-500 font-medium">Already have an account? </span>
                            <Link to="/login" className="text-gray-900 hover:text-[#6366F1] font-bold">
                                Sign in
                            </Link>
                        </div>
                    </Form>
                </div>
            </div>

            {/* Right Column - Visuals */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#1E3A8A] to-[#0F172A] relative overflow-hidden items-center justify-center">
                {/* Decorative background elements */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent pointer-events-none"></div>
                
                {/* Glassmorphic floating cards */}
                <div className="relative w-full max-w-2xl h-[600px]">
                    
                    {/* Mystery Box Card */}
                    <div className="absolute top-10 right-20 w-64 h-64 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-6 transform hover:-translate-y-2 transition-transform duration-500">
                        <div className="w-24 h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                            <GiftOutlined className="text-5xl text-white" />
                        </div>
                        <h3 className="text-white font-bold text-xl">Mystery Box</h3>
                        <p className="text-blue-200/80 text-sm mt-1">100% Drop Rate</p>
                    </div>

                    {/* Performance Card */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl flex flex-col items-center justify-center p-8 z-10">
                        <div className="relative w-36 h-36 rounded-full border-4 border-blue-400/30 flex items-center justify-center mb-4">
                            <div className="absolute inset-0 border-4 border-blue-400 rounded-full border-t-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
                            <div className="text-white text-3xl font-extrabold">2.4k<span className="text-lg text-blue-300 ml-1">+</span></div>
                        </div>
                        <h3 className="text-white font-bold text-xl">Impressions</h3>
                        <p className="text-blue-200/80 text-sm mt-1 text-center">Across all active campaigns</p>
                    </div>

                    {/* Fast Upload / Map Pin Card */}
                    <div className="absolute bottom-16 left-12 bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-xl">
                        <div className="w-12 h-12 bg-[#10B981] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <CompassOutlined className="text-2xl text-white" />
                        </div>
                        <div>
                            <h4 className="text-white font-bold">Location Based</h4>
                            <p className="text-emerald-200/80 text-xs uppercase tracking-wider font-semibold mt-1">Geo-targeted Ads</p>
                        </div>
                    </div>

                    {/* Mini Analytics Card */}
                    <div className="absolute bottom-32 right-10 bg-[#4F46E5]/20 backdrop-blur-md border border-[#4F46E5]/30 rounded-2xl p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-lg bg-[#4F46E5] flex items-center justify-center">
                                <BarChartOutlined className="text-white" />
                            </div>
                            <span className="text-white text-xs font-bold px-2 py-1 bg-white/10 rounded-md">+14%</span>
                        </div>
                        <h4 className="text-white font-bold mt-2">Conversion</h4>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Register;

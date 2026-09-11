import { Layout, Dropdown, Avatar, Modal, Button, Form, Input, Select, message } from 'antd';
import { DownOutlined, LogoutOutlined, ScanOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logOut } from '../../../store/authSlice';
import { useEffect, useState } from 'react';
import { BASE_URL } from '../../../app/constant';

const { Header } = Layout;

export default function DashboardHeader() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [merchantName, setMerchantName] = useState('Merchant');
    const [profilePicUrl, setProfilePicUrl] = useState("https://i.pravatar.cc/150?img=11");
    
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [redeemForm] = Form.useForm();

    useEffect(() => {
        const loadUser = () => {
            const storedUser = localStorage.getItem('merchantUser');
            if (storedUser) {
                try {
                    const userObj = JSON.parse(storedUser);
                    if (userObj && userObj.name) {
                        setMerchantName(userObj.name);
                    }
                    if (userObj && userObj.profilePicUrl) {
                        setProfilePicUrl(userObj.profilePicUrl);
                    }
                } catch (e) {
                    console.error("Error parsing local storage merchant data", e);
                }
            }
        };

        loadUser();
        window.addEventListener('profilePicUpdated', loadUser);

        return () => window.removeEventListener('profilePicUpdated', loadUser);
    }, []);
    const handleLogout = async () => {
        try {
            dispatch(logOut());
            localStorage.removeItem('merchantUser');
            localStorage.removeItem('token');
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const items = [
        {
            key: '1',
            label: 'Logout',
            icon: <LogoutOutlined />,
            onClick: handleLogout
        }
    ];

    const handleRedeemSubmit = async (values) => {
        setIsRedeeming(true);
        try {
            const token = localStorage.getItem('token');
            const endpoint = values.type === 'ad' ? '/merchant/ads/redeem-coupon' : '/merchant/events/redeem-coupon';
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ couponCode: values.couponCode })
            });
            const data = await res.json();
            if (data.status) {
                message.success(data.msg || "Coupon successfully redeemed!");
                setIsRedeemModalOpen(false);
                redeemForm.resetFields();
            } else {
                message.error(data.msg || "Failed to redeem coupon.");
            }
        } catch (error) {
            message.error("Error redeeming coupon");
        } finally {
            setIsRedeeming(false);
        }
    };

    return (
        <Header style={{ background: '#ffffff', padding: 0 }} className="w-full px-8 flex items-center justify-end h-20 shadow-sm border-b border-gray-100 z-10 relative">
            <div className="flex items-center gap-6 mr-2">

                {/*
                <Button 
                    type="primary" 
                    icon={<ScanOutlined />} 
                    onClick={() => setIsRedeemModalOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600"
                >
                    Redeem Code
                </Button>
                */}

                <Dropdown menu={{ items }} trigger={['click']}>
                    <div className="flex items-center gap-3 cursor-pointer">
                        <Avatar src={profilePicUrl} size="large" />
                        <div className="hidden md:block">
                            <p className="text-sm font-bold text-gray-900 m-0 leading-tight">{merchantName}</p>
                            <p className="text-xs text-gray-500 m-0">Owner</p>
                        </div>
                        <DownOutlined className="text-xs text-gray-500" />
                    </div>
                </Dropdown>
            </div>

            <Modal
                title="Redeem Coupon Code"
                open={isRedeemModalOpen}
                onCancel={() => {
                    setIsRedeemModalOpen(false);
                    redeemForm.resetFields();
                }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={redeemForm}
                    layout="vertical"
                    onFinish={handleRedeemSubmit}
                    initialValues={{ type: 'ad' }}
                    className="mt-4"
                >
                    <Form.Item
                        name="type"
                        label="Coupon Type"
                        rules={[{ required: true, message: 'Please select a coupon type' }]}
                    >
                        <Select size="large">
                            <Select.Option value="ad">Ad Campaign Coupon</Select.Option>
                            <Select.Option value="event">Live Event Coupon</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="couponCode"
                        label="Coupon Code"
                        rules={[{ required: true, message: 'Please enter the coupon code' }]}
                    >
                        <Input placeholder="Enter the code shown by user" size="large" />
                    </Form.Item>

                    <Form.Item className="mb-0 text-right mt-6">
                        <Button onClick={() => setIsRedeemModalOpen(false)} className="mr-2">
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" loading={isRedeeming} className="bg-orange-500">
                            Redeem
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Header>
    );
}

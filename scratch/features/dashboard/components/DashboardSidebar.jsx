import React, { useState, useEffect } from 'react';
import { Menu, Button, Layout, Tag } from 'antd';
import {
    AppstoreOutlined,
    NotificationOutlined,
    GiftOutlined,
    SettingOutlined,
    EnvironmentOutlined,
    CreditCardOutlined,
    HistoryOutlined,
    StarFilled
} from '@ant-design/icons';
import {
    Link,
    useLocation
} from 'react-router-dom';
import { useSelector } from 'react-redux';
import logo from '../../../assets/logo.png';

const { Sider } = Layout;

const menuItems = [
    { key: '/', icon: <AppstoreOutlined />, label: <Link to="/">Dashboard</Link> },
    { key: '/events', icon: <EnvironmentOutlined />, label: <Link to="/events">Events (Raidr)</Link> },
    // { key: '/campaigns', icon: <NotificationOutlined />, label: <Link to="/campaigns">Campaigns</Link> },
    { key: '/rewards', icon: <GiftOutlined />, label: <Link to="/rewards">Rewards & Inventory</Link> },
    { key: '/payments', icon: <CreditCardOutlined />, label: <Link to="/payments">Purchase Credits</Link> },
    { key: '/billing', icon: <HistoryOutlined />, label: <Link to="/billing">Billing History</Link> },
    { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Settings</Link> },
];

export default function DashboardSidebar({ collapsed }) {
    const location = useLocation();
    const credits = useSelector((state) => state.auth.credits);
    const [businessName, setBusinessName] = useState('My Business');
    const [category, setCategory] = useState('Merchant');

    useEffect(() => {
        const updateBusinessInfo = () => {
            const storedUser = localStorage.getItem('merchantUser');
            if (storedUser) {
                try {
                    const userObj = JSON.parse(storedUser);
                    if (userObj.businessName) setBusinessName(userObj.businessName);
                    if (userObj.category) setCategory(userObj.category);
                } catch (e) {
                    console.error("Error parsing merchant user for sidebar", e);
                }
            }
        };

        updateBusinessInfo();

        window.addEventListener('businessInfoUpdated', updateBusinessInfo);
        return () => window.removeEventListener('businessInfoUpdated', updateBusinessInfo);
    }, []);

    const getInitials = (name) => {
        if (!name) return 'MB';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            width={260}
            className="bg-[#111827] flex flex-col h-screen overflow-y-auto"
            theme="dark"
            style={{ position: 'fixed', left: 0, top: 0, bottom: 0, backgroundColor: '#111827', zIndex: 50 }}
        >
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Raidr Logo" className="w-8 h-8 object-contain" />
                    {!collapsed && (
                        <div>
                            <h1 className="text-white text-lg font-bold m-0 leading-none">Raidr</h1>
                            <span className="text-gray-400 text-xs">Merchant Hub</span>
                        </div>
                    )}
                </div>
            </div>

            <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[location.pathname]}
                items={menuItems}
                style={{ backgroundColor: '#111827' }}
                className="custom-sidebar-menu flex-grow"
            />

            {!collapsed && (
                <div className="p-6 mt-auto">
                    <Link to="/payments" className="block relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg blur opacity-30 group-hover:opacity-70 transition duration-300"></div>
                        <div className="relative flex items-center justify-center gap-2 bg-gray-900/80 px-4 py-2.5 rounded-lg cursor-pointer border border-yellow-500/20 hover:border-yellow-400/50 transition-all shadow-lg backdrop-blur-sm">
                            <StarFilled className="text-yellow-400 text-lg drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse" />
                            <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 text-base tracking-wide">
                                {credits} Credits
                            </span>
                        </div>
                    </Link>
                </div>
            )}
        </Sider>
    );
}

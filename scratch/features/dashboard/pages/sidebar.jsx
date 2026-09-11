import { useState } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardHeader from '../components/DashboardHeader';

const { Content } = Layout;

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Layout className="min-h-screen bg-gray-50">
            <DashboardSidebar collapsed={collapsed} />
            <Layout className="transition-all duration-300 bg-gray-50" style={{ marginLeft: collapsed ? 80 : 260 }}>
                <DashboardHeader />
                <Content className="p-8 max-w-[1600px] w-full mx-auto">
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}

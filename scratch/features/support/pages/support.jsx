import React from 'react';
import { Row, Col, Card, Form, Input, Button, Collapse, Table, Tag, Divider } from 'antd';
import { 
  CustomerServiceOutlined, 
  MailOutlined, 
  PhoneOutlined, 
  SendOutlined,
  QuestionCircleOutlined 
} from '@ant-design/icons';

const { Panel } = Collapse;
const { TextArea } = Input;

const recentTickets = [
  { key: '1', id: '#WT-892', subject: 'Campaign not starting', status: 'Resolved', date: 'May 20, 2024' },
  { key: '2', id: '#WT-895', subject: 'Billing question for Pro plan', status: 'In Progress', date: 'May 22, 2024' },
];

const ticketColumns = [
  {
    title: 'Ticket ID',
    dataIndex: 'id',
    key: 'id',
    render: (text) => <span className="font-semibold text-gray-900">{text}</span>,
  },
  {
    title: 'Subject',
    dataIndex: 'subject',
    key: 'subject',
    render: (text) => <span className="text-gray-700">{text}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      let color = 'blue';
      if (status === 'Resolved') color = 'green';
      if (status === 'In Progress') color = 'orange';
      return <Tag color={color} className="rounded-md border-none">{status}</Tag>;
    },
  },
  {
    title: 'Date',
    dataIndex: 'date',
    key: 'date',
    render: (text) => <span className="text-gray-500 text-sm">{text}</span>,
  },
];

const Support = () => {
  const [form] = Form.useForm();

  const handleSubmit = (values) => {
    console.log('Submitted Ticket:', values);
    form.resetFields();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Support & Help Center</h1>
        <p className="text-gray-500">Need assistance? We're here to help you succeed with your campaigns.</p>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Submit Ticket & History */}
        <Col xs={24} lg={15}>
          <div className="space-y-6">
            <Card bordered={false} className="shadow-sm rounded-2xl">
              <div className="mb-6 flex items-center gap-2">
                <CustomerServiceOutlined className="text-2xl text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900 m-0">Submit a Ticket</h3>
              </div>
              <Form layout="vertical" form={form} onFinish={handleSubmit}>
                <Form.Item label="Subject" name="subject" rules={[{ required: true, message: 'Please enter a subject' }]}>
                  <Input size="large" className="rounded-lg" placeholder="Brief description of the issue" />
                </Form.Item>
                <Form.Item label="Message" name="message" rules={[{ required: true, message: 'Please provide details' }]}>
                  <TextArea rows={5} className="rounded-lg" placeholder="How can we help you today?" />
                </Form.Item>
                <div className="flex justify-end pt-2">
                  <Button type="primary" htmlType="submit" className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg font-medium h-10 px-6 shadow-sm flex items-center gap-2">
                    <SendOutlined /> Submit Ticket
                  </Button>
                </div>
              </Form>
            </Card>

            <Card bordered={false} className="shadow-sm rounded-2xl" bodyStyle={{ padding: 0 }}>
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900 m-0">Recent Tickets</h3>
              </div>
              <Table 
                columns={ticketColumns} 
                dataSource={recentTickets} 
                pagination={false}
                className="w-full"
                rowClassName="hover:bg-gray-50 transition-colors"
              />
            </Card>
          </div>
        </Col>

        {/* Right Column: Contact Info & FAQ */}
        <Col xs={24} lg={9}>
          <div className="space-y-6">
            <Card bordered={false} className="shadow-sm rounded-2xl">
              <h3 className="text-lg font-bold mb-6 text-gray-900">Contact Us Directly</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
                    <MailOutlined className="text-lg" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm m-0">Email Support</p>
                    <p className="font-semibold m-0 text-gray-900">support@raidr.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                    <PhoneOutlined className="text-lg" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm m-0">Phone (Pro Plan Only)</p>
                    <p className="font-semibold m-0 text-gray-900">+1 (800) 123-4567</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="shadow-sm rounded-2xl">
              <div className="mb-4 flex items-center gap-2">
                <QuestionCircleOutlined className="text-xl text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 m-0">Frequently Asked Questions</h3>
              </div>
              <Collapse ghost expandIconPosition="end" className="custom-faq-collapse">
                <Panel header={<span className="font-medium text-gray-800">How do I create a new campaign?</span>} key="1">
                  <p className="text-gray-500 text-sm">Navigate to the Campaigns tab and click the "Create Campaign" button in the top right corner. You'll be guided through a simple wizard to set up your rules and rewards.</p>
                </Panel>
                <Panel header={<span className="font-medium text-gray-800">When do I get billed?</span>} key="2">
                  <p className="text-gray-500 text-sm">Billing occurs on a monthly cycle based on your sign-up date. You can view your upcoming billing date in the Transactions tab.</p>
                </Panel>
                <Panel header={<span className="font-medium text-gray-800">Can I upgrade my plan later?</span>} key="3">
                  <p className="text-gray-500 text-sm">Absolutely! You can upgrade or downgrade your plan at any time from the Settings page. Prorated charges will apply.</p>
                </Panel>
                <Panel header={<span className="font-medium text-gray-800">How does the MiniSite work?</span>} key="4">
                  <p className="text-gray-500 text-sm">Your MiniSite is a public-facing page where users can view all your active campaigns. You can customize its appearance in the MiniSite tab.</p>
                </Panel>
              </Collapse>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Support;

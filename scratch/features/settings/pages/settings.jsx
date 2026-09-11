import React, { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, Switch, Divider, Avatar, Upload, message } from 'antd';
import {
  UserOutlined,
  ShopOutlined,
  BellOutlined,
  SecurityScanOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { storage, db, auth } from '../../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useMerchantWhoamiQuery, useUpdateUserMutation, useUpdateBusinessMutation, useChangePasswordMutation } from '../../auth/api/auth';

const Settings = () => {
  const [form] = Form.useForm();
  const [businessForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [profilePicUrl, setProfilePicUrl] = useState("https://i.pravatar.cc/150?img=11");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [updateUser] = useUpdateUserMutation();
  const [updateBusiness] = useUpdateBusinessMutation();
  const [changePassword] = useChangePasswordMutation();

  // Fetch the current merchant data including credits
  useMerchantWhoamiQuery();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('merchantUser');
      let userObj = {};
      if (storedUser) {
        userObj = JSON.parse(storedUser);
        if (userObj.profilePicUrl) {
          setProfilePicUrl(userObj.profilePicUrl);
        }

        form.setFieldsValue({
          ownerName: userObj.name || '',
          email: userObj.email,
          phone: userObj.phone || '',
        });

        businessForm.setFieldsValue({
          businessName: userObj.businessName || '',
          address: userObj.address || '',
        });
      }

      const uid = userObj.uid || auth.currentUser?.uid;
      if (uid) {
        getDoc(doc(db, 'merchants', uid)).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.profilePicUrl) {
              setProfilePicUrl(data.profilePicUrl);
              userObj.profilePicUrl = data.profilePicUrl;
            }
            form.setFieldsValue({
              ownerName: data.ownerName || '',
              email: data.email || '',
              phone: data.phone || ''
            });
            businessForm.setFieldsValue({
              businessName: data.businessName || '',
              address: data.address || ''
            });

            userObj.uid = uid;
            userObj.name = data.ownerName || '';
            userObj.email = data.email || '';
            userObj.phone = data.phone || '';
            userObj.businessName = data.businessName || '';
            userObj.address = data.address || '';
            userObj.category = data.category || 'Merchant';
            localStorage.setItem('merchantUser', JSON.stringify(userObj));
          }
        });
      }
    } catch (e) {
      console.error("Failed to load user profile picture", e);
    }
  }, []);

  const handleUpload = async ({ file }) => {
    setUploading(true);
    try {
      const storageRef = ref(storage, `merchant-profile-pic/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setProfilePicUrl(url);
      message.success('Profile picture updated successfully!');

      const storedUser = localStorage.getItem('merchantUser');
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        userObj.profilePicUrl = url;
        localStorage.setItem('merchantUser', JSON.stringify(userObj));

        const uid = userObj.uid || auth.currentUser?.uid;
        if (uid) {
          const docRef = doc(db, 'merchants', uid);
          await updateDoc(docRef, { profilePicUrl: url });
        }

        window.dispatchEvent(new Event('profilePicUpdated'));
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      message.error('Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const newOwnerName = values.ownerName ? values.ownerName.trim() : '';

      await updateUser({
        name: newOwnerName,
        email: values.email,
        phone: values.phone || ""
      }).unwrap();

      message.success('Settings saved successfully!');
      window.dispatchEvent(new Event('profilePicUpdated'));

      const storedUser = localStorage.getItem('merchantUser');
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        userObj.name = newOwnerName;
        userObj.email = values.email;
        userObj.phone = values.phone || "";
        localStorage.setItem('merchantUser', JSON.stringify(userObj));
      }
    } catch (err) {
      console.error('Validation or save failed:', err);
      message.error(err?.data?.msg || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleBusinessSave = async () => {
    setSavingBusiness(true);
    try {
      const values = await businessForm.validateFields();

      await updateBusiness({
        businessName: values.businessName || "",
        address: values.address || ""
      }).unwrap();

      message.success('Business information saved successfully!');
      window.dispatchEvent(new Event('businessInfoUpdated'));

      const storedUser = localStorage.getItem('merchantUser');
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        userObj.businessName = values.businessName || "";
        userObj.address = values.address || "";
        localStorage.setItem('merchantUser', JSON.stringify(userObj));
      }
    } catch (err) {
      console.error('Validation or save failed:', err);
      message.error(err?.data?.msg || 'Failed to save business information.');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handlePasswordChange = async () => {
    setUpdatingPassword(true);
    try {
      const values = await passwordForm.validateFields();
      if (values.new !== values.confirm) {
        message.error("New passwords do not match!");
        return;
      }

      await changePassword({
        currentPassword: values.current,
        newPassword: values.new,
        confirmPassword: values.confirm
      }).unwrap();

      message.success("Password updated successfully!");
      passwordForm.resetFields();
    } catch (error) {
      console.error("Password update error", error);
      message.error(error?.data?.msg || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const profileContent = (
    <div className="max-w-2xl">
      <div className="flex items-center gap-6 mb-8">
        <Avatar size={80} icon={<UserOutlined />} src={profilePicUrl} className="border border-gray-200 shadow-sm" />
        <div>
          <h3 className="text-lg font-bold text-gray-900 m-0">Profile Picture</h3>
          <p className="text-sm text-gray-500 mb-3">PNG, JPEG under 2MB</p>
          <Upload
            showUploadList={false}
            customRequest={handleUpload}
            accept="image/png, image/jpeg"
          >
            <Button icon={<UploadOutlined />} size="small" loading={uploading}>Upload New</Button>
          </Upload>
        </div>
      </div>

      <Form layout="vertical" form={form}>
        <Form.Item label="Owner Name" name="ownerName">
          <Input size="large" className="rounded-lg" />
        </Form.Item>
        <Form.Item label="Email Address" name="email">
          <Input size="large" className="rounded-lg" />
        </Form.Item>
        <Form.Item label="Phone Number" name="phone">
          <Input size="large" className="rounded-lg" placeholder="+1 (555) 000-0000" />
        </Form.Item>
        <div className="pt-4">
          <Button type="primary" onClick={handleSave} loading={saving} className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg font-medium h-10 px-6 shadow-sm">
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );

  const businessContent = (
    <div className="max-w-2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Business Information</h3>
      <Form layout="vertical" form={businessForm}>
        <Form.Item label="Business Name" name="businessName">
          <Input size="large" className="rounded-lg" />
        </Form.Item>
        <Form.Item label="Business Address" name="address">
          <Input.TextArea rows={3} className="rounded-lg" placeholder="123 Coffee Lane..." />
        </Form.Item>
        <div className="pt-4">
          <Button type="primary" onClick={handleBusinessSave} loading={savingBusiness} className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg font-medium h-10 px-6 shadow-sm">
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );



  const securityContent = (
    <div className="max-w-2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Security & Authentication</h3>
      <div className="space-y-8">
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Change Password</h4>
          <Form layout="vertical" form={passwordForm}>
            <Form.Item label="Current Password" name="current" rules={[{ required: true, message: 'Please enter current password' }]}>
              <Input.Password size="large" className="rounded-lg" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item label="New Password" name="new" rules={[{ required: true, message: 'Please enter new password' }]}>
                <Input.Password size="large" className="rounded-lg" />
              </Form.Item>
              <Form.Item label="Confirm Password" name="confirm" rules={[{ required: true, message: 'Please confirm new password' }]}>
                <Input.Password size="large" className="rounded-lg" />
              </Form.Item>
            </div>
            <Button type="primary" onClick={handlePasswordChange} loading={updatingPassword} className="bg-[#1677ff] hover:bg-[#4096ff] border-none rounded-lg font-medium h-10 px-6 shadow-sm">
              Update Password
            </Button>
          </Form>
        </div>

      </div>
    </div>
  );

  const tabItems = [
    {
      key: 'profile',
      label: <span className="flex items-center gap-2"><UserOutlined /> Personal Info</span>,
      children: profileContent,
    },
    {
      key: 'business',
      label: <span className="flex items-center gap-2"><ShopOutlined /> Business Details</span>,
      children: businessContent,
    },

    {
      key: 'security',
      label: <span className="flex items-center gap-2"><SecurityScanOutlined /> Security</span>,
      children: securityContent,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-500">Manage your account preferences and business configuration.</p>
      </div>

      {/* Settings Container */}
      <Card bordered={false} className="shadow-sm rounded-2xl min-h-[600px]">
        <Tabs
          tabPosition="left"
          items={tabItems}
          className="custom-settings-tabs"
          size="large"
        />
      </Card>
    </div>
  );
};

export default Settings;

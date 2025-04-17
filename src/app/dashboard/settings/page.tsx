'use client';
import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Typography, Form, message, Modal } from 'antd';
import { getCurrentUser, updateProfile, updatePassword, setup2FA, verify2FA, disable2FA, get2FAStatus } from '@/utils/api';
import type { User, UpdateProfileData, UpdatePasswordData, TwoFactorVerifyData } from '@/utils/api';
import '@/styles/SettingsPage.css';

const { Title } = Typography;

const SettingsPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationToken, setVerificationToken] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = await getCurrentUser();
        const twoFactorStatus = await get2FAStatus();
        
        setUserData(user);
        setTwoFactorEnabled(twoFactorStatus.isEnabled);
        form.setFieldsValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        });
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        message.error('Failed to load user data');
      }
    };

    fetchUserData();
  }, [form]);

  const handleUpdateProfile = async (values: UpdateProfileData) => {
    setLoading(true);
    try {
      const updatedUser = await updateProfile(values);
      setUserData(updatedUser);
      message.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      message.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (values: UpdatePasswordData & { confirmPassword: string }) => {
    setLoading(true);
    try {
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('Password updated successfully');
      form.resetFields(['currentPassword', 'newPassword', 'confirmPassword']);
    } catch (error) {
      console.error('Failed to update password:', error);
      message.error('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const response = await setup2FA();
      setQrCodeUrl(response.qrCodeUrl);
      setSecret(response.secret);
      setSetupModalVisible(true);
    } catch (error) {
      console.error('Failed to setup 2FA:', error);
      message.error('Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    try {
      await verify2FA({ token: verificationToken });
      setTwoFactorEnabled(true);
      setSetupModalVisible(false);
      message.success('Two-factor authentication enabled successfully');
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      message.error('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setDisableModalVisible(true);
  };

  const handleDisable2FAConfirm = async () => {
    if (!verificationToken) {
      message.error('Please enter verification code');
      return;
    }

    setLoading(true);
    try {
      await disable2FA({ token: verificationToken });
      setTwoFactorEnabled(false);
      setDisableModalVisible(false);
      setVerificationToken('');
      message.success('Two-factor authentication disabled successfully');
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      message.error('Failed to disable 2FA. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <Title level={2}>Settings</Title>

      <Card className="settings-card">
        <Title level={4}>Two-Factor Authentication</Title>
        <div className="two-factor-section">
          {!twoFactorEnabled ? (
            <div>
              <p>Enhance your account security by enabling two-factor authentication.</p>
              <Button type="primary" onClick={handleSetup2FA} loading={loading}>
                Enable 2FA
              </Button>
            </div>
          ) : (
            <div>
              <p>Two-factor authentication is currently enabled.</p>
              <Button danger onClick={handleDisable2FA} loading={loading}>
                Disable 2FA
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="settings-card">
        <Title level={4}>Change Password</Title>
        <Form onFinish={handleUpdatePassword} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Please input your current password!' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[{ required: true, message: 'Please input your new password!' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Update Password
          </Button>
        </Form>
      </Card>

      <Card className="settings-card">
        <Title level={4}>Edit Personal Information</Title>
        <Form
          form={form}
          onFinish={handleUpdateProfile}
          layout="vertical"
        >
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: 'Please input your first name!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: 'Please input your last name!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone"
            rules={[{ pattern: /^\+?[\d\s-]+$/, message: 'Please enter a valid phone number!' }]}
          >
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Changes
          </Button>
        </Form>
      </Card>

      <Modal
        title="Setup Two-Factor Authentication"
        open={setupModalVisible}
        onCancel={() => setSetupModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSetupModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="verify" type="primary" onClick={handleVerify2FA} loading={loading}>
            Verify
          </Button>,
        ]}
      >
        <div className="two-factor-setup">
          <p>1. Scan this QR code with your authenticator app:</p>
          <div className="qr-code">
            <img src={qrCodeUrl} alt="2FA QR Code" />
          </div>
          <p>2. Or manually enter this secret key:</p>
          <Input.TextArea
            value={secret}
            readOnly
            rows={2}
            className="secret-key"
          />
          <p>3. Enter the verification code from your authenticator app:</p>
          <Input
            value={verificationToken}
            onChange={(e) => setVerificationToken(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
          />
        </div>
      </Modal>

      <Modal
        title="Disable Two-Factor Authentication"
        open={disableModalVisible}
        onCancel={() => {
          setDisableModalVisible(false);
          setVerificationToken('');
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setDisableModalVisible(false);
              setVerificationToken('');
            }}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            danger
            type="primary"
            loading={loading}
            onClick={handleDisable2FAConfirm}
          >
            Disable 2FA
          </Button>,
        ]}
      >
        <div className="two-factor-auth">
          <p>Please enter your current verification code to disable 2FA:</p>
          <Input
            value={verificationToken}
            onChange={(e) => setVerificationToken(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="mt-4"
          />
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;

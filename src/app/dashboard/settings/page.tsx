'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    Avatar,
    Upload,
    Select,
    Spin,
    message,
    Row,
    Col,
    Typography,
    Divider,
    Modal, // Added Modal
    Image, // Added Image
    Alert, // Added Alert
} from 'antd';
import { UploadOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { UploadChangeParam } from 'antd/es/upload';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import {
    getCurrentUser,
    updateProfile,
    updatePassword,
    uploadImage,
    setup2FA,      // Added 2FA API functions
    verify2FA,
    disable2FA,
    get2FAStatus,
    User,
    UpdateProfileData,
    UpdatePasswordData,
    TwoFactorStatus, // Added 2FA types
    TwoFactorSetupResponse,
} from '@/utils/api';
import timezones from './timezones';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const getBase64 = (img: RcFile, callback: (url: string) => void) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => callback(reader.result as string));
    reader.readAsDataURL(img);
};

const beforeUpload = (file: RcFile) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
        message.error('You can only upload JPG/PNG file!');
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
        message.error('Image must smaller than 2MB!');
    }
    return isJpgOrPng && isLt2M;
};


const SettingsPage: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // --- 2FA State ---
    const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
    const [loading2FAStatus, setLoading2FAStatus] = useState(true);
    const [twoFactorSetupData, setTwoFactorSetupData] = useState<TwoFactorSetupResponse | null>(null);
    const [setupModalVisible, setSetupModalVisible] = useState(false);
    const [disableModalVisible, setDisableModalVisible] = useState(false);
    const [verificationToken, setVerificationToken] = useState('');
    const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);
    const [isDisabling2FA, setIsDisabling2FA] = useState(false);
    // --- End 2FA State ---

    const fetch2FAStatus = useCallback(async () => {
        setLoading2FAStatus(true);
        try {
            const status = await get2FAStatus();
            setTwoFactorStatus(status);
        } catch (error) {
            console.error('Failed to fetch 2FA status:', error);
            message.error('Could not load 2FA status.');
            setTwoFactorStatus({ isEnabled: false }); 
        } finally {
            setLoading2FAStatus(false);
        }
    }, []);


    const fetchUserAnd2FA = useCallback(async () => {
        setLoading(true);
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
            profileForm.setFieldsValue({
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                email: currentUser.email,
                company: currentUser.company || '',
                timeZone: currentUser.timeZone || '',
            });
            setAvatarUrl(currentUser.avatar);
            await fetch2FAStatus(); // Fetch 2FA status after getting user
        } catch (error) {
            message.error('Failed to load user data.');
            console.error('Fetch User Error:', error);
        } finally {
            setLoading(false);
        }
    }, [profileForm, fetch2FAStatus]);

    useEffect(() => {
        fetchUserAnd2FA();
    }, [fetchUserAnd2FA]);

    const handleProfileUpdate = async (values: UpdateProfileData) => {
        setSavingProfile(true);
        try {
            const updatedUser = await updateProfile(values);
            setUser(updatedUser);
            message.success('Profile updated successfully!');
        } catch (error) {
            message.error('Failed to update profile.');
            console.error('Update Profile Error:', error);
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordChange = async (values: UpdatePasswordData) => {
        setSavingPassword(true);
        try {
            await updatePassword(values);
            message.success('Password changed successfully!');
            passwordForm.resetFields();
        } catch (error: any) {
             const errorMsg = error.response?.data?.message || 'Failed to change password.';
             message.error(errorMsg);
             console.error('Change Password Error:', error);
        } finally {
            setSavingPassword(false);
        }
    };

    const handleAvatarUpload = async (info: UploadChangeParam<UploadFile>) => {
        if (info.file.status === 'uploading') {
            setUploadingAvatar(true);
            return;
        }
        if (info.file.status === 'done') {
            setUploadingAvatar(false);
             const response = info.file.response;
             if (response && response.url) {
                setAvatarUrl(response.url);
                try {
                    await updateProfile({ avatar: response.url });
                    message.success('Avatar updated successfully!');
                } catch (error) {
                     message.error('Failed to save avatar URL.');
                     console.error('Avatar URL Save Error:', error);
                }
             } else {
                 message.error('Upload completed but failed to get avatar URL.');
                 console.error('Avatar Upload Response Error:', response);
             }
        } else if (info.file.status === 'error') {
            setUploadingAvatar(false);
            message.error(`${info.file.name} file upload failed.`);
            console.error('Avatar Upload Error:', info.file.error);
        }
    };

     const customAvatarRequest = async (options: any) => {
         const { onSuccess, onError, file } = options;
         try {
             const response = await uploadImage(file as RcFile, 'logo');
             onSuccess(response, file);
         } catch (error) {
             console.error("Custom Upload Error:", error);
             onError(error);
         }
     };

    // --- 2FA Handlers ---
    const handleEnable2FA = async () => {
        setIsSettingUp2FA(true);
        try {
            const setupData = await setup2FA();
            setTwoFactorSetupData(setupData);
            setSetupModalVisible(true);
            setVerificationToken(''); // Clear previous token
        } catch (error) {
            message.error('Failed to start 2FA setup.');
            console.error('Enable 2FA Error:', error);
        } finally {
            setIsSettingUp2FA(false);
        }
    };

    const handleVerify2FA = async () => {
        if (!verificationToken || verificationToken.length !== 6) {
            message.error('Please enter a valid 6-digit verification code.');
            return;
        }
        setIsVerifying2FA(true);
        try {
            await verify2FA({ token: verificationToken });
            message.success('Two-Factor Authentication enabled successfully!');
            setSetupModalVisible(false);
            setTwoFactorSetupData(null);
            await fetch2FAStatus(); // Refresh status
        } catch (error) {
            message.error('Failed to verify 2FA code. Please check the code and try again.');
            console.error('Verify 2FA Error:', error);
        } finally {
            setIsVerifying2FA(false);
        }
    };

    const handleDisable2FA = () => {
        setVerificationToken(''); // Clear previous token
        setDisableModalVisible(true);
    };

    const handleConfirmDisable2FA = async () => {
        if (!verificationToken || verificationToken.length !== 6) {
            message.error('Please enter a valid 6-digit verification code to confirm.');
            return;
        }
        setIsDisabling2FA(true);
        try {
            await disable2FA({ token: verificationToken });
            message.success('Two-Factor Authentication disabled successfully!');
            setDisableModalVisible(false);
            await fetch2FAStatus(); // Refresh status
        } catch (error) {
            message.error('Failed to disable 2FA. Please check the code and try again.');
            console.error('Disable 2FA Error:', error);
        } finally {
            setIsDisabling2FA(false);
        }
    };
    // --- End 2FA Handlers ---


    if (loading || loading2FAStatus) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" /></div>;
    }

    if (!user) {
        return <div style={{ padding: '20px' }}>Failed to load user data. Please try refreshing.</div>;
    }

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2} style={{ marginBottom: '24px' }}>Settings</Title>
            <Row gutter={[24, 24]}>
                {/* Profile Information Card */}
                <Col xs={24} lg={12}>
                    <Card title="Profile Information">
                         <Form
                            form={profileForm}
                            layout="vertical"
                            onFinish={handleProfileUpdate}
                            initialValues={{
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                company: user.company || '',
                                timeZone: user.timeZone || '',
                            }}
                        >
                            <Row gutter={16}>
                                <Col span={24} style={{ textAlign: 'center', marginBottom: '20px' }}>
                                    <Upload
                                        name="avatar"
                                        listType="picture-circle"
                                        className="avatar-uploader"
                                        showUploadList={false}
                                        customRequest={customAvatarRequest}
                                        beforeUpload={beforeUpload}
                                        onChange={handleAvatarUpload}
                                        disabled={uploadingAvatar}
                                    >
                                        {avatarUrl ? (
                                            <Avatar src={avatarUrl} size={100} />
                                        ) : (
                                           <div style={{textAlign: 'center'}}>
                                                {uploadingAvatar ? <Spin /> : <UserOutlined style={{fontSize: '32px', color: '#999'}} />}
                                                <div style={{ marginTop: 8 }}>Upload</div>
                                            </div>
                                        )}
                                    </Upload>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="firstName"
                                        label="First Name"
                                        rules={[{ required: true, message: 'Please input your first name!' }]}
                                    >
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="lastName"
                                        label="Last Name"
                                        rules={[{ required: true, message: 'Please input your last name!' }]}
                                    >
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                     <Form.Item name="email" label="Email">
                                         <Input disabled />
                                     </Form.Item>
                                 </Col>
                                 <Col span={24}>
                                     <Form.Item name="company" label="Company">
                                         <Input placeholder="Your company name (Optional)" />
                                     </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item name="timeZone" label="Time Zone">
                                        <Select showSearch placeholder="Select your time zone">
                                            {timezones.map(tz => (
                                                <Option key={tz} value={tz}>{tz}</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item style={{ marginTop: '20px', textAlign: 'right' }}>
                                <Button type="primary" htmlType="submit" loading={savingProfile}>
                                    Save Profile Changes
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>

                 {/* Security Settings Card (Password & 2FA) */}
                <Col xs={24} lg={12}>
                    <Card title="Security Settings">
                         {/* Change Password Section */}
                         <Title level={4}>Change Password</Title>
                         <Form
                            form={passwordForm}
                            layout="vertical"
                            onFinish={handlePasswordChange}
                            style={{ marginBottom: '24px' }}
                        >
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
                                rules={[
                                    { required: true, message: 'Please input your new password!' },
                                    { min: 8, message: 'Password must be at least 8 characters long!' }
                                ]}
                                hasFeedback
                            >
                                <Input.Password />
                            </Form.Item>
                            <Form.Item
                                name="confirmPassword"
                                label="Confirm New Password"
                                dependencies={['newPassword']}
                                hasFeedback
                                rules={[
                                    { required: true, message: 'Please confirm your new password!' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('newPassword') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('The two passwords that you entered do not match!'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password />
                            </Form.Item>
                            <Form.Item style={{ marginTop: '20px', textAlign: 'right' }}>
                                <Button type="primary" htmlType="submit" loading={savingPassword}>
                                    Change Password
                                </Button>
                            </Form.Item>
                        </Form>

                        <Divider />

                         {/* Two-Factor Authentication Section */}
                         <Title level={4} style={{ marginTop: '24px' }}>Two-Factor Authentication (2FA)</Title>
                         {twoFactorStatus?.isEnabled ? (
                             <>
                                <Alert
                                    message="2FA is Enabled"
                                    description="Your account is protected with two-factor authentication."
                                    type="success"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                                <Button
                                    type="primary"
                                    danger
                                    onClick={handleDisable2FA}
                                    loading={isDisabling2FA}
                                >
                                    Disable 2FA
                                </Button>
                             </>
                         ) : (
                             <>
                                <Alert
                                    message="2FA is Disabled"
                                    description="Enable two-factor authentication for enhanced account security."
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                                 <Button
                                    type="primary"
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={handleEnable2FA}
                                    loading={isSettingUp2FA}
                                >
                                    Enable 2FA
                                </Button>
                             </>
                         )}
                    </Card>
                </Col>
            </Row>

            {/* 2FA Setup Modal */}
            <Modal
                title="Enable Two-Factor Authentication"
                open={setupModalVisible}
                onCancel={() => setSetupModalVisible(false)}
                footer={[
                    <Button key="back" onClick={() => setSetupModalVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={isVerifying2FA}
                        onClick={handleVerify2FA}
                        disabled={!verificationToken || verificationToken.length !== 6}
                    >
                        Verify and Enable
                    </Button>,
                ]}
                width={400} // Adjust width as needed
            >
                {twoFactorSetupData ? (
                    <>
                        <Paragraph>1. Scan the QR code below with your authenticator app (like Google Authenticator, Authy, etc.).</Paragraph>
                        <div style={{ textAlign: 'center', margin: '20px 0' }}>
                            <Image
                                width={150}
                                src={twoFactorSetupData.qrCodeUrl}
                                preview={false} // Disable preview for QR codes generally
                                alt="2FA QR Code"
                            />
                        </div>
                        <Paragraph>2. If you cannot scan the code, manually enter this secret key into your app:</Paragraph>
                        <Paragraph copyable strong style={{ fontFamily: 'monospace', background: '#f5f5f5', padding: '5px 10px', display: 'inline-block', borderRadius: '4px' }}>
                            {twoFactorSetupData.secret}
                        </Paragraph>
                        <Divider />
                        <Paragraph>3. Enter the 6-digit code generated by your authenticator app below:</Paragraph>
                        <Input
                            placeholder="Enter 6-digit code"
                            value={verificationToken}
                            onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))} // Allow only digits
                            maxLength={6}
                            style={{ width: '100%' }}
                            autoFocus
                        />
                    </>
                ) : (
                    <Spin /> // Show spinner if setup data is loading
                )}
            </Modal>

             {/* 2FA Disable Confirmation Modal */}
            <Modal
                title="Disable Two-Factor Authentication"
                open={disableModalVisible}
                onCancel={() => setDisableModalVisible(false)}
                footer={[
                    <Button key="back" onClick={() => setDisableModalVisible(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        danger
                        loading={isDisabling2FA}
                        onClick={handleConfirmDisable2FA}
                        disabled={!verificationToken || verificationToken.length !== 6}
                    >
                        Confirm and Disable
                    </Button>,
                ]}
                width={400}
            >
                <Paragraph>Enter the 6-digit code from your authenticator app to confirm disabling 2FA.</Paragraph>
                <Input
                    placeholder="Enter 6-digit code"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))} // Allow only digits
                    maxLength={6}
                    style={{ width: '100%' }}
                    autoFocus
                />
            </Modal>

        </div>
    );
};

export default SettingsPage;
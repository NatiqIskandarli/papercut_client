'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { Modal, Input, Button, message, Tabs, Divider, Form, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { checkEmail, sendMagicLink, verifyMagicLink } from '@/utils/api';
import dynamic from 'next/dynamic';
import { FormInstance } from 'antd/lib/form';
import Cookies from 'js-cookie';

// Define necessary interfaces
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  lastLoginAt?: string | null;
  emailVerifiedAt?: string | null;
  avatar?: string | null; // null değerine izin vermek için
  phone?: string | null;   // null değerine izin vermek için
  [key: string]: any;      // Diğer olası özelliklere izin vermek için
}

interface LoginResponse {
  accessToken: string;
  user: User;
  requiresTwoFactor?: boolean;
}

interface SignInFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

interface SignUpFormValues {
  email: string;
}

interface TwoFactorModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  twoFactorToken: string;
  setTwoFactorToken: (value: string) => void;
  isLoading: boolean;
}

// Client-side only components
const ClientOnlyModal = dynamic(() => Promise.resolve(Modal), {
  ssr: false,
});

const ClientOnlyTabs = dynamic(() => Promise.resolve(Tabs), {
  ssr: false,
});

// Client-side only 2FA Modal component with proper types
const TwoFactorAuthModal = dynamic<TwoFactorModalProps>(() => 
  Promise.resolve(
    ({ visible, onCancel, onSubmit, twoFactorToken, setTwoFactorToken, isLoading }: TwoFactorModalProps) => (
      <Modal
        title="Two-Factor Authentication Required"
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="cancel" onClick={onCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isLoading}
            onClick={onSubmit}
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>,
        ]}
      >
        <div className="two-factor-auth">
          <p>Please enter the verification code from your authenticator app:</p>
          <Input
            value={twoFactorToken}
            onChange={(e) => setTwoFactorToken(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="mt-4"
          />
        </div>
      </Modal>
    )
  ), 
  { ssr: false }
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  // State for client-side rendering control
  const [isClient, setIsClient] = useState<boolean>(false);
  
  // Modal visibility state
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  
  // Active tab key
  const [activeTab, setActiveTab] = useState<string>('signin');
  
  // Form states
  const [signInForm] = Form.useForm<SignInFormValues>();
  const [signUpForm] = Form.useForm<SignUpFormValues>();
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showTwoFactorModal, setShowTwoFactorModal] = useState<boolean>(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string>('');
  const [tempUserData, setTempUserData] = useState<User | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<boolean>(false);

  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
    setIsModalVisible(true);
  }, []);

  // Check for magic links on load
  useEffect(() => {
    // Only run on client
    if (!isClient) return;

    // Check for magic link token
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const searchParamsToken = searchParams?.get('token');
    
    console.log('URL:', window.location.href);
    console.log('Direct URL token:', urlToken);
    console.log('SearchParams token:', searchParamsToken);
    
    const token = urlToken || searchParamsToken;
    
    if (token) {
      handleMagicLinkVerification(token);
    }
  }, [searchParams, isClient]);

  // Handle redirections with proper loading state
  useEffect(() => {
    if (loginSuccess) {
      // Keep loading state true while redirecting
      setIsLoading(true);
      const returnUrl = searchParams?.get('from') || '/dashboard';
      //window.location.href = '/dashboard';
      
      // Use router.push - Next.js will handle the navigation
     router.push(returnUrl);
    }
  }, [loginSuccess, router, searchParams]);

  const handleMagicLinkVerification = async (token: string) => {
    try {
      setIsLoading(true);
      const response = await verifyMagicLink(token);
      console.log('Magic link verification response:', response);
      
      if (!response.user.password) {
        // Redirect to create password page with the token
        window.location.href = `/create-password?token=${token}`;
        return;
      }
      
      if (response.requiresTwoFactor) {
        setTempUserData(response.user);
        setShowTwoFactorModal(true);
        setIsLoading(false);
      } else {
        // Cookie is already set by the server
        const returnUrl = searchParams?.get('from') || '/dashboard';
        window.location.href = returnUrl;
      }
    } catch (error) {
      console.error('Magic link verification error:', error);
      message.error('Invalid or expired magic link');
      setIsLoading(false);
    }
  };

  const handleSignIn = async (values: SignInFormValues) => {
    setIsLoading(true);
    setError('');
    console.log('Login attempt started...');
    
    try {
      const response = await login(values.email, values.password);
      console.log('Login response received:', response);
      
      if (response?.requiresTwoFactor) {
        setTempUserData(response.user);
        setShowTwoFactorModal(true);
        setIsLoading(false);
      } else if (response?.accessToken) {
        // Manual cookie təyin etmə (əlavə tədbir kimi)
        Cookies.set('access_token_w', response.accessToken, { 
          secure: true,
          sameSite: 'none',
          expires: 1,
          domain: window.location.hostname.includes('localhost') ? 'localhost' : undefined
        });

        
        
        console.log('Login successful, redirecting...');
        
        // Qısa bir gecikmə təyin edin - cookie'nin saxlanılmağına imkan verir
        setTimeout(() => {
          setLoginSuccess(true);
        }, 500);
      } else {
        console.error('Login successful but no access token received');
        setError('Login successful but no access token received');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Login error details:', error);
      const errorMessage = error.response?.data?.message || 
                          (error.message || 'Unknown error occurred');
      const statusCode = error.response?.status || 'No status';
      console.error(`Login failed with status ${statusCode}: ${errorMessage}`);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleSignUp = async (values: SignUpFormValues) => {
    setIsLoading(true);
    setError('');
    
    try {
      // First check if the email is associated with an organization
      const emailCheck = await checkEmail(values.email);
      if (!emailCheck.organization) {
        setError('Your email domain is not associated with any organization');
        setIsLoading(false);
        return;
      }
      
      await sendMagicLink(values.email);
      message.success('Magic link sent! Please check your email');
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error sending magic link:', error);
      if (error.response?.status === 403) {
        setError('Your email domain is not associated with any organization');
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.status === 429) {
        setError('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setError('Failed to send magic link. Please try again later.');
      }
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async () => {
    setIsLoading(true);
    try {
      const email = signInForm.getFieldValue('email') || '';
      const password = signInForm.getFieldValue('password') || '';
      
      await login(email, password, twoFactorToken);
      setShowTwoFactorModal(false);
      setLoginSuccess(true);
    } catch (error: any) {
      console.error('2FA verification error:', error);
      message.error('Invalid verification code');
      setIsLoading(false);
    }
  };

  // Render conditional tabs content
  const getTabItems = () => [
    {
      key: 'signin',
      label: 'Sign In',
      children: (
        <div className="py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            </div>
          )}
          <Form
            form={signInForm}
            name="signin"
            initialValues={{ remember: true }}
            onFinish={handleSignIn}
            layout="vertical"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input 
                prefix={<UserOutlined className="site-form-item-icon" />} 
                placeholder="Email" 
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="site-form-item-icon" />}
                placeholder="Password"
                size="large"
              />
            </Form.Item>
            <Form.Item>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>Remember me</Checkbox>
              </Form.Item>

              <a 
                className="float-right text-indigo-600 hover:text-indigo-500"
                onClick={() => setActiveTab('signup')}
              >
                Need a magic link?
              </a>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="w-full h-10"
                loading={isLoading}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: 'signup',
      label: 'Sign Up',
      children: (
        <div className="py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            </div>
          )}
          <Form
            form={signUpForm}
            name="signup"
            onFinish={handleSignUp}
            layout="vertical"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input 
                prefix={<MailOutlined className="site-form-item-icon" />} 
                placeholder="Email" 
                size="large"
              />
            </Form.Item>

            <p className="text-sm text-gray-500 mb-4">
              We'll send you a magic link to sign in quickly without a password.
            </p>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="w-full h-10"
                loading={isLoading}
              >
                Send Magic Link
              </Button>
            </Form.Item>

            <div className="text-center mt-2">
              <a 
                className="text-indigo-600 hover:text-indigo-500 text-sm"
                onClick={() => setActiveTab('signin')}
              >
                Have a password? Sign in
              </a>
            </div>
          </Form>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo and title centered at the top */}
        <div className="text-center mb-10">
          <div className="mx-auto w-12 h-12 relative">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">W</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Welcome to Our Platform
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in or sign up to get started
          </p>
        </div>

        {/* Main Auth Modal - Only render on client */}
        {isClient && (
          <ClientOnlyModal
            open={isModalVisible}
            footer={null}
            closable={false}
            maskClosable={false}
            width={420}
            centered
          >
            <ClientOnlyTabs
              activeKey={activeTab}
              onChange={setActiveTab}
              centered
              items={getTabItems()}
            />
          </ClientOnlyModal>
        )}

        {/* Two-Factor Authentication Modal - Only render on client */}
        {isClient && (
          <TwoFactorAuthModal
            visible={showTwoFactorModal}
            onCancel={() => setShowTwoFactorModal(false)}
            onSubmit={handleTwoFactorSubmit}
            twoFactorToken={twoFactorToken}
            setTwoFactorToken={setTwoFactorToken}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
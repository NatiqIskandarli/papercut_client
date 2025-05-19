'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { Modal, Input, Button, message } from 'antd';
import { checkEmail, sendMagicLink, verifyMagicLink } from '@/utils/api';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [tempUserData, setTempUserData] = useState<any>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    // Check for magic link token in URL using multiple methods
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const searchParamsToken = searchParams.get('token');
    
    console.log('URL:', window.location.href);
    console.log('Direct URL token:', urlToken);
    console.log('SearchParams token:', searchParamsToken);
    
    const token = urlToken || searchParamsToken;
    
    if (token) {
      handleMagicLinkVerification(token);
    }
  }, [searchParams]);

  // Add this new useEffect for handling redirections
  useEffect(() => {
    if (loginSuccess) {
      const returnUrl = searchParams.get('from') || '/dashboard';
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
      } else {
        localStorage.setItem('access_token_w', response.accessToken);
        const returnUrl = searchParams.get('from') || '/dashboard';
        window.location.href = returnUrl;
      }
    } catch (error) {
      console.error('Magic link verification error:', error);
      message.error('Invalid or expired magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailCheck = async (email: string) => {
    if (!email) return;
    
    try {
      setIsLoading(true);
      const response = await checkEmail(email);
      
      if (response.exists && response.hasPassword) {
        setShowPassword(true);
      } else if (!response.organization) {
        setError('Your email domain is not associated with any organization');
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Email check error:', error);
      setIsLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // First check if the email is associated with an organization
      const emailCheck = await checkEmail(formData.email);
      if (!emailCheck.organization) {
        setError('Your email domain is not associated with any organization');
        return;
      }
      
      await sendMagicLink(formData.email);
      message.success('Magic link sent! Please check your email');
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await login(formData.email, formData.password);
      
      if (response?.requiresTwoFactor) {
        setTempUserData(response.user);
        setShowTwoFactorModal(true);
      } else if (response?.accessToken) {
        localStorage.setItem('access_token_w', response.accessToken);
        setLoginSuccess(true);
      } else {
        setError('Login successful but no access token received');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // Update handleTwoFactorSubmit as well
  const handleTwoFactorSubmit = async () => {
    setIsLoading(true);
    try {
      await login(formData.email, formData.password, twoFactorToken);
      setShowTwoFactorModal(false);
      setLoginSuccess(true);
    } catch (error) {
      console.error('2FA verification error:', error);
      message.error('Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mx-auto w-12 h-12 relative">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">W</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
          <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                </div>
              )}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setShowPassword(false);
                      setError('');
                    }}
                    onBlur={(e) => handleEmailCheck(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              {!showPassword && (
                <Button
                  type="primary"
                  onClick={handleSendMagicLink}
                  disabled={!formData.email || isLoading}
                  className="w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Magic Link'}
                </Button>
              )}

              {showPassword && (
                <>
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium leading-6 text-gray-900"
                    >
                      Password
                    </label>
                    <div className="mt-2">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={(e) =>
                          setFormData({ ...formData, rememberMe: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label
                        htmlFor="remember-me"
                        className="ml-3 block text-sm leading-6 text-gray-900"
                      >
                        Remember me
                      </label>
                    </div>

                    <div className="text-sm leading-6">
                      <button
                        type="button"
                        onClick={handleSendMagicLink}
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        Use Magic Link
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>

      <Modal
        title="Two-Factor Authentication Required"
        open={showTwoFactorModal}
        onCancel={() => setShowTwoFactorModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowTwoFactorModal(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isLoading}
            onClick={handleTwoFactorSubmit}
          >
            Verify
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
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...Wait..</div>}>
      <LoginContent />
    </Suspense>
  );
}
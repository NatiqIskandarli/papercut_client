// page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { Modal, Input, Button, message } from 'antd';
import { checkEmail, sendMagicLink, verifyMagicLink, LoginResponse as ApiLoginResponse, User as ApiUser } from '@/utils/api'; // Assuming verifyMagicLink returns LoginResponse

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: contextLogin, user: authUser, loading: authLoading } = useAuth(); // Renamed to avoid conflict
  
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
  const [tempUserData, setTempUserData] = useState<any>(null); // Consider using a more specific type
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
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
  }, [searchParams]); // Removed 'router' as it's not directly used for token checking logic

  useEffect(() => {
    if (loginSuccess) {
      const returnUrl = searchParams.get('from') || '/dashboard';
      router.push(returnUrl);
    }
  }, [loginSuccess, router, searchParams]);

  const handleMagicLinkVerification = async (token: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response: ApiLoginResponse = await verifyMagicLink(token); // verifyMagicLink should set HttpOnly cookie via backend
      console.log('Magic link verification response:', response);
      
      if (response.user && !response.user.password && !response.user.hasPassword) { // Check if password needs to be set
        // Backend sets HttpOnly cookie, now redirect to create password
        // The token in URL is for password creation, not session
        router.push(`/create-password?token=${token}`);
        return;
      }
      
      if (response.requiresTwoFactor && response.user) {
        setTempUserData({ email: response.user.email }); // Store minimal data needed for 2FA, like email
        setShowTwoFactorModal(true);
      } else if (response.user) {
        // AuthContext will re-check auth due to HttpOnly cookie being set by backend.
        // Forcing a reload or relying on AuthProvider's checkAuth upon navigation.
        // We can directly navigate if the cookie is reliably set.
        setLoginSuccess(true);
      } else {
         setError('Magic link verification failed to return user data.');
      }
    } catch (error: any) {
      console.error('Magic link verification error:', error);
      setError(error.response?.data?.message || 'Invalid or expired magic link. Please try again.');
      message.error(error.response?.data?.message || 'Invalid or expired magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailCheck = async (email: string) => {
    if (!email) return;
    
    try {
      setIsLoading(true);
      setError('');
      const response = await checkEmail(email);
      
      if (response.exists && response.hasPassword) {
        setShowPassword(true);
      } else if (response.exists && !response.hasPassword) {
        // User exists but no password, likely magic link flow or needs to set password
        setShowPassword(false); // Keep magic link as primary option
         message.info('This email exists. You can use a magic link or set a password if applicable.');
      } else if (!response.organization) {
        setError('Your email domain is not associated with any organization');
      } else {
        // Email doesn't exist but domain is fine (for new registrations via magic link if supported)
        setShowPassword(false);
      }
    } catch (error: any) {
      console.error('Email check error:', error);
      setError(error.response?.data?.message || 'Error checking email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!formData.email) {
        message.error('Please enter your email address.');
        return;
    }
    try {
      setIsLoading(true);
      setError('');
      
      const emailCheck = await checkEmail(formData.email);
      if (!emailCheck.organization) {
        setError('Your email domain is not associated with any organization');
        setIsLoading(false);
        return;
      }
      
      await sendMagicLink(formData.email);
      message.success('Magic link sent! Please check your email.');
    } catch (error: any) {
      console.error('Error sending magic link:', error);
      if (error.response?.status === 403) {
        setError('Your email domain is not associated with any organization.');
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
      // contextLogin is from useAuth(), it handles setting user state and HttpOnly cookie (via backend)
      const response = await contextLogin(formData.email, formData.password); 
      
      if (response?.requiresTwoFactor && response.user) {
        setTempUserData(response.user); // Store user data for 2FA step
        setShowTwoFactorModal(true);
      } else if (response?.user) { // Backend sets HttpOnly cookie
        setLoginSuccess(true); // Trigger navigation
      } else {
        setError('Login successful but no user data or token received as expected.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async () => {
    setIsLoading(true);
    setError('');
    const emailFor2FA = tempUserData?.email || formData.email; // Prefer tempUserData if available
    const passwordFor2FA = formData.password; // Password must be available from form

    if (!emailFor2FA || !passwordFor2FA) {
        setError('Email or password missing for 2FA verification.');
        setIsLoading(false);
        setShowTwoFactorModal(false);
        return;
    }

    try {
      // contextLogin handles 2FA token submission
      const response = await contextLogin(emailFor2FA, passwordFor2FA, twoFactorToken);
      if (response?.user && !response.requiresTwoFactor) {
        setShowTwoFactorModal(false);
        setLoginSuccess(true); // Trigger navigation
      } else if (response?.requiresTwoFactor) {
         setError('2FA still required or an issue occurred.'); // Should not happen if code is correct
      } else {
        setError('2FA verification failed or user data not received.');
      }
    } catch (error: any) {
      console.error('2FA verification error:', error);
      setError(error.response?.data?.message || 'Invalid verification code. Please try again.');
      message.error(error.response?.data?.message || 'Invalid verification code');
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
                      setFormData({ ...formData, email: e.target.value, password: '' }); // Clear password on email change
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
                  loading={isLoading && !showPassword}
                  className="w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                >
                  {isLoading && !showPassword ? 'Sending...' : 'Send Magic Link'}
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
                        onClick={() => {
                            setShowPassword(false); // Switch to magic link view
                            setError('');
                            handleSendMagicLink(); // Optionally send magic link immediately
                        }}
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        Use Magic Link Instead
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isLoading || !formData.password}
                      className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      {isLoading && showPassword ? 'Signing in...' : 'Sign in'}
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
        onCancel={() => {
            setShowTwoFactorModal(false);
            setTempUserData(null); // Clear temporary data
            setTwoFactorToken(''); // Clear token input
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowTwoFactorModal(false);
            setTempUserData(null);
            setTwoFactorToken('');
          }}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isLoading}
            onClick={handleTwoFactorSubmit}
            disabled={!twoFactorToken || twoFactorToken.length < 6}
          >
            Verify
          </Button>,
        ]}
      >
        <div className="two-factor-auth">
          <p>Please enter the verification code from your authenticator app for {tempUserData?.email || formData.email}:</p>
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
    <Suspense fallback={<div>Loading Page Content...</div>}>
      <LoginContent />
    </Suspense>
  );
}
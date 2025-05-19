'use client';
import React, { useState, useEffect } from 'react';
import { Layout, Avatar, Dropdown, List, Typography, Menu, Badge, Spin, message } from 'antd'; // Added Spin, message
import {
    BulbOutlined,
    GlobalOutlined,
    BellOutlined,
    SettingOutlined,
    LogoutOutlined,
    UserOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import '@/styles/NavigationBar.css';
import { getCurrentUser, logoutUser } from '@/utils/api';
import { notificationService } from '@/app/services/notificationService';

const { Header } = Layout;
const { Text } = Typography;

const NavigationBar = () => {
    const [quickNotificationsVisible, setQuickNotificationsVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loggingOut, setLoggingOut] = useState(false); // State for logout loading
    const router = useRouter();
    const pathname = usePathname();
    const isPaperCut = pathname && pathname.includes('PaperCut');

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const user = await getCurrentUser();
                setCurrentUser(user);
            } catch (error) {
                console.error('Failed to fetch current user:', error);
            }
        };

        fetchCurrentUser();
    }, []);

    useEffect(() => {
        const fetchNotifications = async () => {
            // Only fetch if currentUser is loaded to ensure we are likely authenticated
            if (!currentUser) return;
            try {
                const fetchedNotifications = await notificationService.getNotifications();
                console.log('Fetched notifications:', fetchedNotifications);
                setNotifications(fetchedNotifications);
                const count = fetchedNotifications.filter(notification => !notification.read).length;
                setUnreadCount(count);
            } catch (error) {
                // Avoid spamming errors if token expires during polling
                if (error.message && !error.message.includes('401')) {
                    console.error('Failed to fetch notifications:', error);
                }
            }
        };

        // Fetch immediately if user is loaded, otherwise wait
        if(currentUser) {
            fetchNotifications();
        }
        const intervalId = setInterval(fetchNotifications, 60000);
        return () => clearInterval(intervalId);
    }, [currentUser]); // Re-run when currentUser changes

    const toggleQuickNotifications = () => {
        setQuickNotificationsVisible(!quickNotificationsVisible);
    };

    const navigateTo = (path) => {
        router.push(path);
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await logoutUser(); // Call backend logout
        } catch (error) {
            console.error("Backend logout failed:", error);

        } finally {
            // Clear any local storage items if necessary
            if (typeof window !== 'undefined') {
                localStorage.removeItem('access_token_w'); // Example if you still use this elsewhere
            }

            window.location.href = '/login';
        }
    };


    // --- YENİ handleNotificationClick Funksiyası ---
    const handleNotificationClick = async (notification) => {
        try {
            // Mark notification as read via service
            await notificationService.markAsRead(notification.id);

            // Update local state immediately for better UX
            const updatedNotifications = notifications.map(n =>
                n.id === notification.id ? { ...n, isRead: true } : n
            );
            setNotifications(updatedNotifications);

            setUnreadCount(updatedNotifications.filter(n => !n.isRead).length);
            console.log(`Notification marked as read: ${notification}`);

            if (notification.type === 'letter') {
                router.push(`/dashboard/LetterReview/${notification.entityId}`);
                console.log(`Navigating to LetterReview for ID: ${notification.entityId}`);
            } else {
                router.push(`/dashboard/LetterPdfReview/${notification.entityId}`);
                console.log(`Navigating to LetterPdfReview for ID: ${notification.entityId}`);
            }

            setQuickNotificationsVisible(false); // Close dropdown after navigation
        } catch (error) {
            message.error('Failed to mark notification as read or navigate.');
            console.error("Error handling notification click:", error);
        }
    };
    // --- YENİ handleNotificationClick Funksiyası Sonu ---

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString.toString();
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const notificationsMenu = (
        <div className="notifications-dropdown" style={{ backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '4px', width: '350px' }}>
            <List
                dataSource={notifications.slice(0, 5)}
                renderItem={(item) => (
                    <List.Item
                        onClick={() => handleNotificationClick(item)}
                        style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', backgroundColor: item.read ? 'transparent' : '#e6f7ff' }}
                    >
                        <List.Item.Meta
                             title={<Text strong>{item.title}</Text>}
                             description={
                                 <>
                                     <div>{item.message}</div>
                                     <Text type="secondary" style={{ fontSize: '12px' }}>{formatDate(item.createdAt)}</Text>
                                 </>
                             }
                         />

                    </List.Item>
                )}
                locale={{ emptyText: "No recent notifications" }}
                style={{ maxHeight: '300px', overflowY: 'auto' }}
            />
            <div className="view-all-button" onClick={() => navigateTo('/dashboard/notifications')} style={{ textAlign: 'center', padding: '10px 0', borderTop: '1px solid #f0f0f0', cursor: 'pointer', color: '#1890ff' }}>
                View All Notifications
            </div>
        </div>
    );

    const userMenu = (
        <Menu>
            <Menu.Item key="userInfo" disabled style={{ cursor: 'default', backgroundColor: 'transparent !important' }}>
                 <div style={{ display: 'flex', alignItems: 'center', padding: '5px 12px' }}>
                     <Avatar src={currentUser?.avatar || undefined} icon={!currentUser?.avatar ? <UserOutlined /> : undefined} size="large" style={{ marginRight: '10px' }} />
                     <div>
                         <Text strong>{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Loading...'}</Text>
                         <br />
                         <Text type="secondary">{currentUser?.email || ''}</Text>
                     </div>
                 </div>
             </Menu.Item>
             <Menu.Divider />

            <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => navigateTo('/dashboard/settings')}>
                Settings
            </Menu.Item>
            <Menu.Item key="logout" icon={loggingOut ? <Spin size="small" /> : <LogoutOutlined />} onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? 'Signing Out...' : 'Sign Out'}
            </Menu.Item>
        </Menu>
    );

    return (
        <Header className="navigation-bar">
            <div className="navigation-links">
               <Link href="/dashboard/" className={`nav-link ${isPaperCut ? '' : 'active'}`}>Home</Link>
               <Link href="#" className="nav-link">Dynamic Sheets</Link>
               <Link href="#" className="nav-link">Recordo</Link>
               <Link href="/dashboard" className={`nav-link active`}>Papercut</Link>
               <Link href="#" className="nav-link">Notebook</Link>
            </div>

            <div className="navigation-actions">
                 <div className="action-item">
                     <BulbOutlined style={{ fontSize: '20px', marginRight: '5px' }} />
                     <span>Dark Mode</span>
                 </div>
                 <div className="action-item">
                     <GlobalOutlined style={{ fontSize: '20px', marginRight: '5px' }} />
                     <span>English</span>
                 </div>

                <div className="action-item">
                    <Dropdown
                        overlay={notificationsMenu}
                        trigger={['click']}
                        placement="bottomRight"
                        open={quickNotificationsVisible}
                        onOpenChange={toggleQuickNotifications}
                    >
                        <Badge count={unreadCount} size="small">
                            <BellOutlined style={{ fontSize: '20px', cursor: 'pointer' }} />
                        </Badge>
                    </Dropdown>
                </div>

                <div className="action-item">
                    <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
                         <Avatar
                             src={currentUser?.avatar || undefined}
                             icon={!currentUser?.avatar ? <UserOutlined /> : undefined}
                             alt="User"
                             size={40}
                             style={{ cursor: 'pointer' }}
                         />
                    </Dropdown>
                </div>
            </div>
        </Header>
    );
};

export default NavigationBar;
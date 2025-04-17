'use client';
import React, { useState, useEffect } from 'react';
import { Layout, Avatar, Dropdown, List, Typography, Menu, Badge } from 'antd';
import {
  BulbOutlined,
  GlobalOutlined,
  BellOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import '@/styles/NavigationBar.css';
import { getCurrentUser } from '@/utils/api';
import { notificationService } from '@/app/services/notificationService';

const { Header } = Layout;
const { Text } = Typography;

const NavigationBar = () => {
  const [quickNotificationsVisible, setQuickNotificationsVisible] = useState(false);
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
        // If unauthorized, the api interceptor will handle the redirect
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const fetchedNotifications = await notificationService.getNotifications();
        setNotifications(fetchedNotifications);
        
        const count = fetchedNotifications.filter(notification => !notification.read).length;
        
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    
    // Setup a refresh interval to periodically check for new notifications
    const intervalId = setInterval(fetchNotifications, 10000); // Check every minute
    
    return () => clearInterval(intervalId); // Clean up on component unmount
  }, []);

  const toggleQuickNotifications = () => {
    setQuickNotificationsVisible(!quickNotificationsVisible);
  };

  const toggleUserMenu = () => {
    setUserMenuVisible(!userMenuVisible);
  };

  const navigateTo = (path) => {
    router.push(path);
  };

  const handleNotificationClick = async (notification) => {
    // Mark notification as read when clicked
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.id);
        // Update the notification in the state
        setNotifications(prevNotifications =>
          prevNotifications.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    
    // Navigate based on entity type and ID
    if (notification.entityType && notification.entityId) {
      let path;
      switch (notification.entityType) {
        case 'space':
          path = `/dashboard/Inbox/Space/${notification.entityId}`;
          break;
        case 'cabinet':
          path = `/dashboard/Inbox/Cabinet/${notification.entityId}`;
          break;
        case 'record':
          path = `/dashboard/Inbox/RecordDetails/${notification.entityId}`;
          break;
        default:
          path = '/dashboard/notifications';
      }
      navigateTo(path);
    }
  };


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

  // Convert notifications dropdown content to Menu items
  const notificationsMenu = {
    items: [
      {
        key: 'notifications',
        label: (
          <div className="notifications-dropdown">
            <List
              dataSource={notifications.slice(0, 4)}
              renderItem={(item) => (
                <List.Item 
                  onClick={() => handleNotificationClick(item)}
                  className={!item.read ? 'unread-notification' : ''}
                >
                  <a onClick={(e) => e.preventDefault()}>
                    <Text strong>{item.title}</Text>
                    <div>{item.message}</div>
                    <Text type="secondary">{formatDate(item.createdAt)}</Text>
                  </a>
                </List.Item>
              )}
              locale={{ emptyText: "No notifications" }}
            />
            <div className="view-all-button" onClick={() => navigateTo('/dashboard/notifications')}>
              View All Notifications
            </div>
          </div>
        ),
      },
    ],
  };

  // Convert user profile dropdown content to Menu items
  const userProfileMenu = {
    items: [
      {
        key: 'user-info',
        type: 'group',
        label: (
          <div className="user-profile-header">
            <Avatar src={currentUser?.avatar || "/images/avatar.png"} size={40} alt="User" />
            <div className="user-info">
              <Text strong>{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Loading...'}</Text>
              <br />
              <Text type="secondary">{currentUser?.email || 'Loading...'}</Text>
            </div>
          </div>
        ),
      },
      {
        type: 'divider',
      },
      {
        key: 'settings',
        label: 'Settings',
        onClick: () => navigateTo('/dashboard/settings'),
      },
      {
        key: 'logout',
        label: 'Log out',
        onClick: () => navigateTo('/logout'),
      },
    ],
  };

  return (
    <Header className="navigation-bar">
      <div className="navigation-links">
        <Link href="/dashboard/" className={`nav-link ${isPaperCut ? '' : 'active'}`}>Home</Link>
        <Link href="/dashboard/dynamic-sheets" className="nav-link">Dynamic Sheets</Link>
        <Link href="/dashboard/recordo" className="nav-link">Recordo</Link>
        <Link href="/dashboard/PaperCut" className={`nav-link ${isPaperCut ? 'active' : ''}`}>Papercut</Link>
        <Link href="/dashboard/notebook" className="nav-link">Notebook</Link>
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
            menu={notificationsMenu}
            trigger={['click']}
            placement="bottomRight"
            open={quickNotificationsVisible}
            onOpenChange={toggleQuickNotifications}
          >
            <div className="notification-icon">
              <Badge count={unreadCount} overflowCount={99}>
                <BellOutlined style={{ fontSize: '20px', marginRight: '5px' }} />
              </Badge>
            </div>
          </Dropdown>
        </div>
        <div className="action-item">
          <Dropdown
            menu={userProfileMenu}
            trigger={['click']}
            placement="bottomRight"
            open={userMenuVisible}
            onOpenChange={toggleUserMenu}
          >
            <Avatar src={currentUser?.avatar || "/images/avatar.png"} alt="User" size={40} />
          </Dropdown>
        </div>
      </div>
    </Header>
  );
};

export default NavigationBar;

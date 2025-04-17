'use client';
import React from 'react';
import { List, Typography } from 'antd';
import '@/styles/NotificationsPage.css';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

const mockNotifications = [
  { id: 1, name: 'Test 1333', action: 'Added', date: '2024-11-19', type: 'Record', link: '/dashboard/Inbox/RecordDetails/1' },
  { id: 2, name: 'Test 2', action: 'Approved', date: '2024-11-18', type: 'Cabinet', link: '/dashboard/Inbox/Cabinet/2' },
  { id: 3, name: 'Test 3', action: 'Modified', date: '2024-11-17', type: 'Space', link: '/dashboard/Inbox/Space/3' },
];

const NotificationsPage = () => {
  const router = useRouter();

  const handleItemClick = (link: any) => {
    router.push(link);
  };

  return (
    <div className="notifications-page">
      <Title level={2}>Notifications</Title>
      <List
        dataSource={mockNotifications}
        renderItem={(item) => (
          <List.Item onClick={() => handleItemClick(item.link)} className="notification-item">
            <Text strong>{item.name}</Text> {item.action} a {item.type} on {item.date}.
          </List.Item>
        )}
      />
    </div>
  );
};

export default NotificationsPage;

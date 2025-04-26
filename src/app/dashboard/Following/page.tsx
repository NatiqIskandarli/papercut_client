'use client';
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tabs, Table, Avatar, Dropdown, Button, Menu, Pagination, Typography } from 'antd';
import {
  FolderOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/app/config';
import '@/styles/Following.css';

const { TabPane } = Tabs;
const { Title } = Typography;

const FollowingPage = () => {
  const router = useRouter();
  const [followedCabinets, setFollowedCabinets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowedCabinets = async () => {
      try {
        const response = await fetch(`${API_URL}/cabinets/followedCabinets`, {
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch followed cabinets');
        }

        const data = await response.json();
        const cabinets = data.map((item: any) => ({
          key: item.cabinet.id,
          type: 'Cabinet',
          description: item.cabinet.description || 'No description',
          company: item.cabinet.company || 'N/A',
          userGroup: item.cabinet.users ? item.cabinet.users.map((user :  any) => ({ avatar: user.avatar })) : [],
          lastUpdated: item.cabinet.lastUpdated ? new Date(item.cabinet.lastUpdated).toLocaleDateString() : 'N/A'
        }));

        setFollowedCabinets(cabinets);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching followed cabinets:', error);
        setLoading(false);
      }
    };

    fetchFollowedCabinets();
  }, []);

  const columns = [
    {
      title: 'Archived Folder',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <div>
          {type === 'Cabinet' ? <FolderOutlined style={{ color: '#ffbb00' }} /> : <FileTextOutlined />}
          <span style={{ marginLeft: 8 }}>{type}</span>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Change to User',
      dataIndex: 'userGroup',
      key: 'userGroup',
      render: (users: any) => (
        <Avatar.Group maxCount={4}>
          {users.map((user: any, index: any) => (
            <Avatar key={index} src={user.avatar} />
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
    },
    {
      title: 'Space Actions',
      key: 'actions',
      render: () => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="1">Action 1</Menu.Item>
              <Menu.Item key="2">Action 2</Menu.Item>
            </Menu>
          }
        >
          <Button icon={<EllipsisOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="following-page">
      <div className="header-section">
        <Button 
            className="back-button" 
            icon={<ArrowLeftOutlined />} 
            type="text" 
            onClick={() => router.back()}
            >
        </Button>
        <Title level={2} className="page-title">Following</Title>
      </div>

      {/* Tabs Section */}
      <Tabs defaultActiveKey="1" className="following-tabs">
        <TabPane tab="Cabinets" key="1">
          <Table
            columns={columns}
            dataSource={followedCabinets}
            pagination={false}
            className="following-table"
            loading={loading}
          />
          <Pagination
            defaultCurrent={1}
            total={followedCabinets.length}
            className="pagination-bar"
            showSizeChanger={false}
            showQuickJumper
          />
        </TabPane>
        <TabPane tab="Files" key="2">
          {/* Additional content for Files tab can be added here */}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default FollowingPage;

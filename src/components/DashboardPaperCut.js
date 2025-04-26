'use client';
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin } from 'antd';
import { RiseOutlined, FallOutlined, DatabaseOutlined, InboxOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '@/app/config';

const DashboardPaperCut = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    {
      label: 'Pending Approval',
      value: 0,
      change: '0% Up from yesterday',
      changeType: 'up',
      icon: <DatabaseOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
    },
    {
      label: 'Completed this month',
      value: 0,
      change: '0% Up from last week',
      changeType: 'up',
      icon: <InboxOutlined style={{ fontSize: '24px', color: '#faad14' }} />,
    },
    {
      label: 'Drafts',
      value: 0,
      change: '0% Down from yesterday',
      changeType: 'down',
      icon: <EditOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />,
    },
    {
      label: 'Total processed',
      value: '0 GB',
      change: '0% Up from last month',
      changeType: 'up',
      icon: <FallOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
    },
  ]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/dashboard/stats`, {
          withCredentials: true
        });
        
        // Update stats with real data
        setStats(prevStats => {
          const newStats = [...prevStats];
          
          // Update Total Records
          newStats[0] = {
            ...newStats[0],
            value: response.data.totalRecords,
            change: '8.5% Up from yesterday', // This could be calculated if we had historical data
          };
          
          // Update New Records
          newStats[1] = {
            ...newStats[1],
            value: response.data.newRecords,
            change: '8.5% Up from last week', // This could be calculated if we had historical data
          };
          
          // Skip Revisions (index 2) as requested
          
          // Update Unallocated
          newStats[3] = {
            ...newStats[3],
            value: response.data.unallocatedSize,
            change: '1.3% Up from last month', // This could be calculated if we had historical data
          };
          
          return newStats;
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  return (
    <Row gutter={[16, 16]} className="mb-6 customDashCard">
      {stats.map((stat, index) => (
        <Col key={index} xs={24} sm={12} md={6}>
          <Card bordered={true} className="flex items-center space-x-4">
            <div className='dashboardModules'>
              <h4 className="text-lg font-semibold">{stat.label}</h4>
              <div className="icon-container">{stat.icon}</div>
            </div>
            <div>
              {loading ? (
                <Spin size="small" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className={`mt-3 ${stat.changeType === 'down' ? 'text-red-500' : 'text-green-500'}`}>
                    {stat.changeType === 'up' ? <RiseOutlined /> : <FallOutlined />} {stat.change}
                  </p>
                </>
              )}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default DashboardPaperCut;

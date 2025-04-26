'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Badge, message } from 'antd';
import { API_URL } from '@/app/config';

const RecentlyAccessed = ({ className }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const getStatusFromAction = useMemo(() => (action) => {
    switch (action) {
      case 'CREATE':
      case 'UPDATE':
      case 'APPROVE':
        return 'completed';
      case 'SUBMIT':
      case 'RESUBMIT':
      case 'REASSIGN':
        return 'pending';
      case 'REJECT':
      case 'DELETE':
        return 'rejected';
      default:
        return 'default';
    }
  }, []);

  const getStatusBadge = useCallback((status) => {
    switch (status) {
      case 'completed':
        return <Badge status="success" text="Completed" />;
      case 'pending':
        return <Badge status="processing" text="Pending" />;
      case 'rejected':
        return <Badge status="error" text="Rejected" />;
      default:
        return <Badge status="default" text={status || 'Unknown'} />;
    }
  }, []);

  const formatActivityData = useCallback((activity) => ({
    id: activity.id,
    user: activity.user?.firstName && activity.user?.lastName 
      ? `${activity.user.firstName} ${activity.user.lastName}`
      : activity.user?.email || 'Unknown User',
    action: activity.action,
    resourceType: activity.resourceType,
    resourceName: activity.resourceName,
    timestamp: activity.timestamp || activity.createdAt,
    status: activity.status || getStatusFromAction(activity.action),
    details: activity.details || ''
  }), [getStatusFromAction]);

  const columns = useMemo(() => [
    { 
      title: 'User', 
      dataIndex: 'user', 
      key: 'user', 
      sorter: (a, b) => (a.user || '').localeCompare(b.user || ''),
    },
    { 
      title: 'Activity', 
      key: 'activity',
      render: (_, record) => `${record.action} ${record.resourceType} "${record.resourceName}"`,
      sorter: (a, b) => `${a.action} ${a.resourceType}`.localeCompare(`${b.action} ${b.resourceType}`),
    },
    { 
      title: 'Date & Time', 
      key: 'timestamp',
      render: (_, record) => new Date(record.timestamp).toLocaleString(),
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      defaultSortOrder: 'descend',
    },
    { 
      title: 'Status', 
      key: 'status',
      render: (_, record) => getStatusBadge(record.status),
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
    }
  ], [getStatusBadge]);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/activities/recent`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const formattedData = data.map(formatActivityData);
      setActivities(formattedData);
    } catch (error) {
      console.error('Error fetching activities:', error);
      
        message.error(`Failed to fetch activities: ${error.message}`);
   
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [formatActivityData]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const tableConfig = useMemo(() => ({
    columns,
    dataSource: activities,
    rowKey: "id",
    pagination: { pageSize: 5 },
    loading
  }), [columns, activities, loading]);

  return (
    <div className={`bg-white p-4 rounded shadow-md ${className || ''}`}>
      <h4 className="text-gray-700 font-semibold mb-4">Activity History</h4>
      <Table {...tableConfig} />
    </div>
  );
};

export default React.memo(RecentlyAccessed);

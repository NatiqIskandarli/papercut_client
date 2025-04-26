'use client';
import React, { useState, useEffect } from 'react';
import { Table, Button, Avatar, message, Modal, Select, Form, Input } from 'antd';
import { getApprovalsWaitingForMe } from '@/utils/api';
import { API_URL } from '@/app/config';

const { TextArea } = Input;


const RejectModal = ({ visible, onCancel, onReject, loading, recordType }) => {
  const [reason, setReason] = useState('');

  return (
    <Modal
      title={`Reject ${recordType}`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button 
          key="reject" 
          type="primary" 
          danger
          loading={loading}
          disabled={!reason.trim()}
          onClick={() => onReject(reason)}
        >
          Reject
        </Button>
      ]}
    >
      <Form layout="vertical">
        <Form.Item 
          label="Rejection Reason" 
          required
          help="Please provide a reason for rejection"
        >
          <TextArea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter reason for rejection"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const Approvals = ({ className }) => {
  const [approvals, setApprovals] = useState([]);
  const [visiblePopover, setVisiblePopover] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [superUsers, setSuperUsers] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  // Add state for rejection functionality
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    fetchApprovals();
    fetchSuperUsers();
  }, []);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const data = await getApprovalsWaitingForMe();
      
      console.log('Approvals:', data);
      const formattedApprovals = data.map(item => ({
        id: item.id,
        name: {
          avatar: item.createdBy?.avatar || '',
          displayName: item.createdBy?.name || 'Unknown User',
        },
        subject: `${item.name}`,
        reason: `${item.type}`,
        type: item.type,
        priority: item.priority || 'Medium',
      }));
      
      setApprovals(formattedApprovals);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      message.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users/superusers`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch super users');
      }

      const data = await response.json();
      setSuperUsers(data);
    } catch (error) {
      console.error('Error fetching super users:', error);
      //message.error('Failed to load super users');
    }
  };


  const handleApprove = async (record) => {
    try {
      let response;
      if (record.type === 'space') {
        response = await fetch(`${API_URL}/approvals/${record.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ 
            type: 'space',
            comment: 'Approved'
          })
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to approve ${record.type}`);
      }

      message.success(`${record.type.charAt(0).toUpperCase() + record.type.slice(1)} approved successfully`);
      fetchApprovals(); // Refresh the data
    } catch (error) {
      console.error('Error approving item:', error);
      message.error('Failed to approve item');
    }
  };


  const handleReject = (record) => {
    // Store the selected record and show the rejection modal
    setSelectedRecord(record);
    setRejectModalVisible(true);
  };

  const processRejection = async (reason) => {
    if (!selectedRecord || !reason.trim()) {
      message.info('Please provide a reason for rejection');
      return;
    }

    try {
      setRejectLoading(true);
      
      let response;
      if (selectedRecord.type === 'space') {
        response = await fetch(`${API_URL}/approvals/${selectedRecord.id}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ 
            type: 'space',
            reason
          })
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to reject ${selectedRecord.type}`);
      }

      message.success(`${selectedRecord.type.charAt(0).toUpperCase() + selectedRecord.type.slice(1)} has been rejected successfully`);
      setRejectModalVisible(false);
      setSelectedRecord(null);
      fetchApprovals(); // Refresh data
    } catch (error) {
      console.error('Error rejecting item:', error);
      message.error('Failed to reject item');
    } finally {
      setRejectLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar src={name.avatar} alt="User" style={{ marginRight: 8 }} />
          <span>{name.displayName}</span>
        </div>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="actionCustom">
          <div className="desktop-actions">
            <Button variant="filled" className='approve' style={{ marginRight: 8 }} onClick={() => handleApprove(record)}>Approve</Button>
            <Button color="danger" variant="filled" onClick={() => handleReject(record)}>Reject</Button>
          </div>
          
        </div>
      ),
    },
  ];

  return (
    <div className={`bg-white p-4 rounded shadow-md ${className || ''}`}>
      <h4 className="text-gray-700 font-semibold mb-4">Pending Approvals</h4>
      <Table 
        columns={columns} 
        dataSource={approvals} 
        rowKey="id" 
        pagination={false} 
        loading={loading}
      />
      
      
      <RejectModal
        visible={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          setSelectedRecord(null);
        }}
        onReject={processRejection}
        loading={rejectLoading}
        recordType={selectedRecord?.type || ''}
      />
    </div>
  );
};

export default Approvals;

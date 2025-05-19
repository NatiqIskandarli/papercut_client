'use client';
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Avatar, Button, Input, Select, Badge, Pagination, Modal, Tooltip, Typography, Form, Alert, Tag } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, SettingOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import '@/styles/UserManagement.css';
import { useRouter } from 'next/navigation';
import { ColumnType } from 'antd/es/table';
import { useAuth } from '@/app/contexts/AuthContext';
import axios from 'axios';

const { Option } = Select;
const { Title } = Typography;

interface UserData {
  key: string;
  name: string;
  avatar?: string;
  status: 'active' | 'inactive';
  role: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
}

const UserManagementPage = () => {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddUserModalVisible, setIsAddUserModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [addUserForm] = Form.useForm();
  const [editForm] = Form.useForm();  const getAuthHeaders = () => {
    return {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true
    };
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const config = getAuthHeaders();
    if (!config) {
        setLoading(false);
        return;
    }

    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/list`, config);
      console.log('API Response Data:', response.data);

      if (response.data && Array.isArray(response.data.users)) {


        const formattedUsers = response.data.users.map((user: any) => ({
          key: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName || 'A')}+${encodeURIComponent(user.lastName || 'B')}&background=random`, // encodeURIComponent əlavə edildi
          status: user.isActive ? 'active' : 'inactive',
          role: user.Roles[0].name || 'member_full',
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          position: user.position || ''
        }));
        console.log('Formatted Users:', formattedUsers);

        setUsers(formattedUsers);


        if (currentUser?.id) {
          const currentUserData = formattedUsers.find((user: any) => user.key === currentUser.id);
          console.log('Current User Data:', currentUserData?.role);
          setCurrentUserRole(currentUserData?.role || null);
        }

      } else {
        console.error("Invalid data structure received from API:", response.data);
        setError('Failed to load users due to unexpected data format.');
        setUsers([]);
      }

    } catch (err) {
      console.error('Failed to fetch users:', err);
      if (axios.isAxiosError(err)) {
        setError(`Failed to load users: ${err.response?.data?.message || err.message}`);
      } else {
        setError('Failed to load users. Please try again.');
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
        fetchUsers();
    }
  }, [currentUser]);

  const showAddUserModal = () => {
    setIsAddUserModalVisible(true);
  };

  const handleAddUserCancel = () => {
    setIsAddUserModalVisible(false);
    addUserForm.resetFields();
  };

  const showEditModal = (record: UserData) => {
    setSelectedUser(record);
    editForm.setFieldsValue({
        name: record.name,
        firstName: record.firstName,
        lastName: record.lastName,
        role: record.role,
        status: record.status,
        email: record.email,
        position: record.position || ''
    });
    setIsEditModalVisible(true);
  };

  const handleEditCancel = () => {
    setIsEditModalVisible(false);
    setSelectedUser(null);
    editForm.resetFields();
  };

  const handleAddUserSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    const config = getAuthHeaders();
     if (!config) {
        setLoading(false);
        return;
    }

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            role: values.role,
            position: values.position || undefined, // Add position field
        },
        config
      );

      if (response.status === 201 || response.status === 200) {
        Modal.success({
          title: 'Success',
          content: 'User has been created successfully.',
        });
        handleAddUserCancel();
        fetchUsers();
      }
    } catch (err: any) {
      console.error('Failed to create user:', err);
      setError(err.response?.data?.message || 'Failed to create user. Please check the details and try again.');
      Modal.error({
        title: 'Error Creating User',
        content: err.response?.data?.message || 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedUser) return;

    try {
        const values = await editForm.validateFields();
        setLoading(true);
        setError(null);
        const config = getAuthHeaders();
        if (!config) {
            setLoading(false);
            return;
        }

        const updateData = {
            firstName: values.firstName,
            lastName: values.lastName,
            role: values.role,
            isActive: values.status === 'active',
            position: values.position || '',
        };
        console.log('Update Data:', updateData);

        const response = await axios.put(
            `${process.env.NEXT_PUBLIC_API_URL}/users/${selectedUser.key}`,
            updateData,
            config
        );

        if (response.status === 200) {
            Modal.success({
                title: 'Success',
                content: 'User information updated successfully.',
            });
            handleEditCancel();
            fetchUsers();
        }
    } catch (err: any) {
        console.error('Failed to update user:', err);
        setError(err.response?.data?.message || 'Failed to update user.');
         Modal.error({
            title: 'Error Updating User',
            content: err.response?.data?.message || 'An unexpected error occurred.',
        });
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (record: UserData) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this user?',
      content: `This action will permanently delete ${record.name}'s account.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No, Cancel',
      onOk: async () => {
        setLoading(true);
        setError(null);
        const config = getAuthHeaders();
        if (!config) {
            setLoading(false);
            return;
        }

        try {
          const response = await axios.delete(
            `${process.env.NEXT_PUBLIC_API_URL}/users/${record.key}`,
            config
          );

          if (response.status === 200 || response.status === 204) {
            Modal.success({
              title: 'Success',
              content: `User ${record.name} deleted successfully.`
            });
            fetchUsers();
          }
        } catch (err: any) {
          console.error('Failed to delete user:', err);
          setError(err.response?.data?.message || 'Failed to delete user.');
          Modal.error({
            title: 'Error Deleting User',
            content: err.response?.data?.message || 'An unexpected error occurred.',
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const columns: ColumnType<UserData>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, record: UserData) => (
        <div className="user-info">
          <Avatar src={record.avatar} >{record.name?.charAt(0)?.toUpperCase()}</Avatar>
          <span className="user-name">{record.name}</span>
        </div>
      ),
       sorter: (a, b) => a.name.localeCompare(b.name),
    },
     {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a, b) => a.email.localeCompare(b.email),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const formattedRole = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let color = 'default';
        if (role.includes('owner')) color = 'volcano';
        if (role.includes('admin')) color = 'red';
        if (role.includes('member')) color = 'blue';
        if (role.includes('guest')) color = 'lime';
        return <Tag color={color}>{formattedRole}</Tag>;
      },
       sorter: (a, b) => a.role.localeCompare(b.role),
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (position: string) => {
        if (!position) return <span>-</span>;
        const formattedPosition = position.charAt(0).toUpperCase() + position.slice(1);
        let color = 'geekblue';
        if (position === 'reviewer') color = 'purple';
        if (position === 'approver') color = 'orange';
        return <Tag color={color}>{formattedPosition}</Tag>;
      },
      sorter: (a, b) => (a.position || '').localeCompare(b.position || ''),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'active' | 'inactive') => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status.charAt(0).toUpperCase() + status.slice(1)}
        />
      ),
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Inactive', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: UserData) => {
        const canEditDelete = currentUserRole === 'super_user' || currentUserRole === 'super_admin' || currentUserRole === 'admin';

        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tooltip title="Edit User">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => showEditModal(record)}
                disabled={!canEditDelete}
              />
            </Tooltip>
            <Tooltip title="Delete User">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                disabled={!canEditDelete || record.key === currentUser?.id}
              />
            </Tooltip>
          </div>
        );
      },
    }
  ];

  return (
    <div className="user-management-page">
      <div className="header-section">
        <Button
            className="back-button"
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => router.back()}
            >
        </Button>
        <Title level={2} className="page-title">User Management</Title>
      </div>

      <div className='user-management-box'>
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <div className="actions-row">
          <Input.Search
            placeholder="Search by name or email..."
            style={{ width: 250 }}
            onSearch={(value) => {
                const lowerCaseValue = value.toLowerCase();
                const filteredData = users.filter(user =>
                    user.name.toLowerCase().includes(lowerCaseValue) ||
                    user.email.toLowerCase().includes(lowerCaseValue)
                );
                console.log("Searching for:", value);
            }}
             onChange={(e) => {
                 const value = e.target.value;
                 if (value === "") {
                     fetchUsers();
                 }
             }}
            allowClear
          />
          <Button icon={<PlusOutlined />} type="primary" onClick={showAddUserModal} className="action-button">
            Add User
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="key"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            total: users.length,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
          }}
          className="user-management-table"
          onChange={(pagination, filters, sorter) => {
              console.log('Params', pagination, filters, sorter);
          }}
        />

      </div>

      <Modal
        title="Add New User"
        visible={isAddUserModalVisible}
        onCancel={handleAddUserCancel}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={handleAddUserCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={() => addUserForm.submit()}
          >
            Add User
          </Button>
        ]}
      >
        <Form
          form={addUserForm}
          layout="vertical"
          onFinish={handleAddUserSubmit}
          initialValues={{ role: 'member_full', position: '' }}
        >
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: 'Please input the first name!' }]}
          >
            <Input placeholder="Enter first name" />
          </Form.Item>

          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: 'Please input the last name!' }]}
          >
            <Input placeholder="Enter last name"/>
          </Form.Item>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please input the email address!' },
              { type: 'email', message: 'Please enter a valid email address!' }
            ]}
          >
            <Input placeholder="Enter email address" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role!' }]}
          >
            <Select placeholder="Select a role">
              <Option value="member_full">Member (Full Access)</Option>
              <Option value="guest">Guest</Option>
            </Select>
          </Form.Item>

          {/* Position dropdown */}
          <Form.Item
            name="position"
            label="Position"
          >
            <Select placeholder="Select a position">
              <Option value="">Nothing</Option>
              <Option value="reviewer">Reviewer</Option>
              <Option value="approver">Approver</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit User Information"
        visible={isEditModalVisible}
        onCancel={handleEditCancel}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={handleEditCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleEditSubmit}
          >
            Save Changes
          </Button>
        ]}
      >
        <Form
          form={editForm}
          layout="vertical"
        >
           <Form.Item
            name="email"
            label="Email Address"
            >
                <Input placeholder="User email address" disabled />
            </Form.Item>

           <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Please input the first name!' }]}
            >
                <Input placeholder="Enter first name" />
            </Form.Item>

            <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Please input the last name!' }]}
            >
                <Input placeholder="Enter last name"/>
            </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select the role!' }]}
          >
            <Select placeholder="Select a role">
              <Option value="member_full">Member (Full Access)</Option>
              <Option value="guest">Guest</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="position"
            label="Position"
          >
            <Select placeholder="Select a position">
              <Option value="">Nothing</Option>
              <Option value="reviewer">Reviewer</Option>
              <Option value="approver">Approver</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select the status!' }]}
          >
            <Select placeholder="Select user status">
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default UserManagementPage;
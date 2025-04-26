'use client';
import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  Button,
  message,
  Modal,
  Typography,
  Spin,
  Divider,
  Space,
  Tag,
  Upload,
  List,
  Popconfirm,
  Empty,
  Avatar
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileOutlined,
  UploadOutlined,
  HistoryOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { API_URL } from '@/app/config';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface RecordVersion {
  id: string;
  version: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  filePath: string;
  uploadedBy: string;
  note?: string;
  createdAt: string;
}

interface RecordDetails {
  id: string;
  title: string;
  customFields: {
    [key: string]: {
      type: string;
      value: any;
      fieldId: number;
      fileName?: string;
      filePath?: string;
      fileSize?: number;
      fileType?: string;
      fileHash?: string;
    };
  };
  cabinet: {
    id: string;
    name: string;
    ownerId: string;
    customFields: {
      id: number;
      name: string;
      type: string;
      isMandatory: boolean;
    }[];
    approvers?: { userId: string }[];
  };
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  fileHash?: string;
  notes?: {
    id: string;
    content: string;
    type: string;
    action?: string;
    createdAt: string;
    creator: {
      id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  }[];
  comments?: {
    id: string;
    content: string;
    type: string;
    action?: string;
    createdAt: string;
    creator: {
      id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  }[];
}

interface ReassignModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (approverId: string) => void;
  loading: boolean;
}

const ReassignModal: React.FC<ReassignModalProps> = ({ visible, onCancel, onOk, loading }) => {
  const [selectedApprover, setSelectedApprover] = useState<string>('');
  const [approvers, setApprovers] = useState<{ id: string; firstName: string, lastName: string }[]>([]);

  useEffect(() => {
    if (visible) {
      fetchApprovers();
    }
  }, [visible]);

  const fetchApprovers = async () => {
    try {
      const response = await fetch(`${API_URL}/users/superusers`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch approvers');
      const data = await response.json();
      setApprovers(data);
    } catch (error) {
      console.error('Error fetching approvers:', error);
      message.error('Failed to load approvers');
    }
  };

  return (
    <Modal
      title="Reassign Record"
      open={visible}
      onCancel={onCancel}
      onOk={() => onOk(selectedApprover)}
      confirmLoading={loading}
    >
      <Select
        style={{ width: '100%' }}
        placeholder="Select an approver"
        onChange={(value) => setSelectedApprover(value)}
      >
        {approvers.map(approver => (
          <Option key={approver.id} value={approver.id}>
            {approver.firstName} {approver.lastName}
          </Option>
        ))}
      </Select>
    </Modal>
  );
};

const RecordDetailsPage = ({ params }: { params: { id: string } }) => {
  const router = useRouter();
  const [record, setRecord] = useState<RecordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [comments, setComments] = useState('');
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ [key: string]: File }>({});
  const [permissions, setPermissions] = useState<{ isCreator: boolean; isApprover: boolean }>({
    isCreator: false,
    isApprover: false
  });
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [myMessage, setMyMessage] = useState('');

  useEffect(() => {
    fetchRecord();
    fetchCurrentUser();
  }, [params.id]);

  // Initialize note and comment fields if available
  useEffect(() => {
    if (record?.notes && record.notes.length > 0) {
      const latestNote = record.notes[0];
      setNote(latestNote.content);
    }
    if (record?.comments && record.comments.length > 0) {
      const latestComment = record.comments[0];
      setComments(latestComment.content);
    }
  }, [record]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      const user = await response.json();
      setCurrentUserId(user.id);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchRecord = async () => {
    try {
      const response = await fetch(`${API_URL}/records/${params.id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch record');
      const data = await response.json();
      console.log('Fetched record:', data);
      setRecord(data);
    } catch (error) {
      console.error('Error fetching record:', error);
      message.error('Failed to load record');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'delete' | 'update') => {
    try {
      setActionLoading(true);
      const method = action === 'delete' ? 'DELETE' : 'PUT';
      const endpoint =
        action === 'delete'
          ? `${API_URL}/records/${params.id}`
          : `${API_URL}/records/${params.id}/${action}`;
  
      // For update/approve/reject actions, prepare FormData to include custom fields and messages
      const formData = new FormData();
      if (action === 'update' || action === 'approve' || action === 'reject') {
        // Process custom fields for update, approve, and reject actions
        const customFieldsData: Record<string, any> = {};
        Object.entries(record?.customFields || {}).forEach(([fieldId, field]) => {
          if (field.type === 'Attachment') {
            if (selectedFile[fieldId]) {
              formData.append('files', selectedFile[fieldId]);
              formData.append('fileFields', fieldId);
              // Set field value to null so backend uses uploaded file info
              customFieldsData[fieldId] = null;
            } else {
              customFieldsData[fieldId] = field.value;
            }
          } else {
            customFieldsData[fieldId] = field.value;
          }
        });
        formData.append('customFields', JSON.stringify(customFieldsData));
        formData.append('title', record?.title || '');
        // If record was rejected and is now being updated/approved, set status to 'pending'
        if (record?.status === 'rejected') {
          formData.append('status', 'pending');
        }
        // Add note and comments – myMessage is used as the updated message content
        let noteContent = '';
        if (action === 'approve') {
          noteContent = note || 'Record approved';
        } else if (action === 'reject') {
          noteContent = note || 'Record rejected';
        } else if (action === 'update') {
          noteContent =
            note || (record?.status === 'rejected' ? 'Record updated and resubmitted' : 'Record updated');
        }
        formData.append('note', myMessage || noteContent);
        formData.append('comments', myMessage);
        formData.append('action', action);
      }
  
      const headers: HeadersInit = {};
      if (action === 'delete') {
        headers['Content-Type'] = 'application/json';
      }
  
      const response = await fetch(endpoint, {
        method,
        headers,
        body: action !== 'delete' ? formData : undefined,
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`Failed to ${action} record`);
  
      if (action === 'update' || action === 'approve') {
        const updatedRecord = await response.json();
        setRecord(updatedRecord);
        setSelectedFile({});
        if (action === 'update' && record?.status === 'rejected') {
          message.success('Record updated and resubmitted for approval');
        } else {
          message.success(`Record ${action}d successfully`);
        }
      } else {
        message.success(`Record ${action}d successfully`);
      }
      if (action !== 'update') {
        router.push('/dashboard/Inbox');
      }
    } catch (error) {
      console.error(`Error ${action}ing record:`, error);
      message.error(`Failed to ${action} record`);
    } finally {
      setActionLoading(false);
    }
  };
  

  const handleReassign = async (approverId: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/records/${params.id}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approverId, note }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to reassign record');
      message.success('Record reassigned successfully');
      setReassignModalVisible(false);
      router.push('/dashboard/Inbox');
    } catch (error) {
      console.error('Error reassigning record:', error);
      message.error('Failed to reassign record');
    } finally {
      setActionLoading(false);
    }
  };

  const checkUserPermissions = async () => {
    if (!record || !currentUserId || !record.creator || !record.cabinet) {
      return { isCreator: false, isApprover: false };
    }
    try {
      const memberResponse = await fetch(
        `${API_URL}/cabinet-members/cabinets/${record.cabinet.id}/members/${currentUserId}`,
        {
          credentials: 'include'
        }
      );
      const memberData = await memberResponse.json();
      const isMemberFull = memberData?.member?.role === 'member_full';
      const isApproverInList =
        record.cabinet.approvers?.some((approver: { userId: string }) => approver.userId === currentUserId) ?? false;
      return {
        isCreator: record.creator.id === currentUserId,
        isApprover: isApproverInList || isMemberFull
      };
    } catch (error) {
      console.error('Error checking member permissions:', error);
      return {
        isCreator: record.creator.id === currentUserId,
        isApprover:
          record.cabinet.approvers?.some((approver: { userId: string }) => approver.userId === currentUserId) ?? false
      };
    }
  };

  useEffect(() => {
    const updatePermissions = async () => {
      if (record && currentUserId) {
        const newPermissions = await checkUserPermissions();
        setPermissions(newPermissions);
      }
    };
    updatePermissions();
  }, [record, currentUserId]);

  const renderFieldValue = (
    field: RecordDetails['customFields'][string],
    fieldDef: RecordDetails['cabinet']['customFields'][0]
  ) => {
    if (!record || !field || !fieldDef) return null;
    const value = field.value;
    const canEdit =
      (permissions.isCreator && record.status !== 'approved') ||
      (permissions.isApprover && record.status === 'pending');

    switch (fieldDef.type) {
      case 'Date':
      case 'Time':
      case 'Time and Date':
        return (
          <DatePicker
            value={value ? dayjs(value) : null}
            disabled={!canEdit}
            style={{ width: '100%' }}
            onChange={(date) => {
              if (canEdit) {
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: date?.toISOString() || null };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
            showTime={fieldDef.type === 'Time and Date'}
            picker={fieldDef.type === 'Time' ? 'time' : undefined}
          />
        );
      case 'Yes/No':
        return (
          <Select
            value={value}
            disabled={!canEdit}
            style={{ width: '100%' }}
            onChange={(val) => {
              if (canEdit) {
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: val === 'Yes' };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
          >
            <Option value={true}>Yes</Option>
            <Option value={false}>No</Option>
          </Select>
        );
      case 'Number Only':
        return (
          <Input
            type="number"
            value={value ?? ''}
            disabled={!canEdit}
            style={{ width: '100%' }}
            onChange={(e) => {
              if (canEdit) {
                const val = e.target.value.trim();
                const num = val !== '' ? Number(val) : null;
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: num };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
          />
        );
      case 'Currency':
        return (
          <Input
            prefix="$"
            type="number"
            value={value}
            disabled={!canEdit}
            onChange={(e) => {
              if (canEdit) {
                const num = e.target.value ? Number(e.target.value) : null;
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: num };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
            onKeyPress={(e) => {
              if (!/[\d.]/.test(e.key)) {
                e.preventDefault();
              }
            }}
          />
        );
      case 'Tags/Labels':
        return (
          <Select
            mode="tags"
            value={value || []}
            disabled={!canEdit}
            style={{ width: '100%' }}
            onChange={(val) => {
              if (canEdit) {
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: val };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
          />
        );
      case 'Attachment':
        const fileInfo = value
          ? {
              fileName: value.fileName || field.fileName,
              filePath: value.filePath || field.filePath,
              fileSize: value.fileSize || field.fileSize,
              fileType: value.fileType || field.fileType,
              fileHash: value.fileHash || field.fileHash
            }
          : null;
        if (!canEdit) {
          return fileInfo ? (
            <Button
              type="link"
              onClick={() =>
                window.open(`${API_URL}/records/file/${fileInfo.filePath}?type=view`, '_blank')
              }
            >
              {fileInfo.fileName}
            </Button>
          ) : (
            <Text type="secondary">No file attached</Text>
          );
        }
        return (
          <Space>
            {fileInfo ? (
              <>
                <Button
                  type="link"
                  onClick={() =>
                    window.open(`${API_URL}/records/file/${fileInfo.filePath}?type=view`, '_blank')
                  }
                >
                  {fileInfo.fileName}
                </Button>
                {fieldDef.isMandatory && (
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      const updatedFields = { ...record?.customFields };
                      updatedFields[fieldDef.id] = { ...field, value: null };
                      setRecord(record ? { ...record, customFields: updatedFields } : null);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </>
            ) : (
              <Upload
                accept=".pdf,.doc,.docx"
                showUploadList={false}
                beforeUpload={(file) => {
                  setSelectedFile({ [fieldDef.id]: file });
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>Select File</Button>
              </Upload>
            )}
          </Space>
        );
      case 'Text Only':
        return (
          <Input
            value={value}
            disabled={!canEdit}
            onChange={(e) => {
              if (canEdit) {
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: e.target.value };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
            onKeyPress={(e) => {
              if (!/[a-zA-Z\s]/.test(e.key)) {
                e.preventDefault();
              }
            }}
          />
        );
      case 'Text/Number with Special Symbols':
      default:
        return (
          <Input
            value={value}
            disabled={!canEdit}
            onChange={(e) => {
              if (canEdit) {
                const updatedFields = { ...record?.customFields };
                updatedFields[fieldDef.id] = { ...field, value: e.target.value };
                setRecord(record ? { ...record, customFields: updatedFields } : null);
              }
            }}
          />
        );
    }
  };

  const mergedMessages = () => {
    const messages = [];
    if (record?.notes) {
      messages.push(...record.notes.map(n => ({ ...n, type: 'note' })));
    }
    if (record?.comments) {
      messages.push(...record.comments.map(c => ({ ...c, type: 'comment' })));
    }
    return messages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  };

  const renderChat = () => {
    const messages = mergedMessages();
    if (!messages.length) {
      return <Empty description="No messages yet" />;
    }
    return (
      <div ref={chatContainerRef} style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', marginBottom: '12px' }}>
          <Avatar 
            src={msg.creator.avatar}
            style={{ marginRight: '8px' }}
            icon={<UserOutlined />} 
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {msg.creator.firstName} {msg.creator.lastName}
            </div>
            <div>{msg.content}</div>
            <div style={{ fontSize: '12px', color: 'gray' }}>
              {dayjs(msg.createdAt).format('MMMM D, YYYY HH:mm')}
            </div>
          </div>
        </div>
        ))}
      </div>
    );
  };

  const renderActionButtons = () => {
    if (!record) return null;
    const { isCreator, isApprover } = permissions;
    if (isCreator && record.status !== 'approved') {
      return (
        <Space>
          <Button type="primary" onClick={() => handleAction('update')} loading={actionLoading}>
            Update
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this record?"
            onConfirm={() => handleAction('delete')}
            okText="Yes"
            cancelText="No"
          >
            <Button danger loading={actionLoading}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      );
    }
    if (isApprover && !isCreator && record.status === 'pending') {
      return (
        <Space>
          <Button type="primary" onClick={() => handleAction('approve')} loading={actionLoading}>
            Approve
          </Button>
          <Button danger onClick={() => handleAction('reject')} loading={actionLoading}>
            Reject
          </Button>
          <Button onClick={() => setReassignModalVisible(true)} loading={actionLoading}>
            Reassign
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this record?"
            onConfirm={() => handleAction('delete')}
            okText="Yes"
            cancelText="No"
          >
            <Button danger loading={actionLoading}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      );
    }
    return null;
  };

  if (loading) {
    return <Spin size="large" />;
  }
  if (!record) {
    return <div>Record not found</div>;
  }

  return (
    <div className="record-details-page" style={{ padding: '24px' }}>
      <div
        className="header-section"
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            className="back-button"
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => router.back()}
          />
          <Title level={2} style={{ margin: 0 }}>
            Record Details
          </Title>
        </div>
        <Space>
          <Tag
            color={
              record.status === 'pending'
                ? 'gold'
                : record.status === 'approved'
                ? 'green'
                : 'red'
            }
          >
            {record.status.toUpperCase()}
          </Tag>
        </Space>
      </div>
      <Card
        className="record-info-card"
        style={{ marginBottom: '24px' }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Record Information</span>
            <Space>
              <Text type="secondary">
                <UserOutlined />{' '}
                {record.creator
                  ? `Created by ${record.creator.firstName} ${record.creator.lastName}`
                  : 'Loading...'}
              </Text>
              <Divider type="vertical" />
              <Text type="secondary">
                <ClockCircleOutlined />{' '}
                {record.createdAt
                  ? dayjs(record.createdAt).format('MMMM D, YYYY HH:mm')
                  : 'Loading...'}
              </Text>
            </Space>
          </div>
        }
      >
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                Title
              </Text>
              {(() => {
                const { isCreator, isApprover } = permissions;
                // const canEdit = (isCreator || isApprover) && record.status === 'pending';
                return (
                  <Input
                    value={record.title}
                    // disabled={!canEdit}
                    onChange={(e) => {
                      if (record) {
                        setRecord({ ...record, title: e.target.value });
                      }
                    }}
                  />
                );
              })()}
            </div>
          </Col>
          {record.cabinet?.customFields?.map(fieldDef => {
            const field = record.customFields?.[fieldDef.id];
            if (!field) return null;
            return (
              <Col span={12} key={fieldDef.id}>
                <div style={{ marginBottom: '16px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                    {fieldDef.name}
                    {fieldDef.isMandatory && <Text type="danger"> *</Text>}
                  </Text>
                  {renderFieldValue(field, fieldDef)}
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>
      <Card title="Notes & Comments" style={{ marginBottom: '24px' }}>
        {renderChat()}
      </Card>
      <TextArea
        rows={4}
        value={myMessage}
        onChange={(e) => setMyMessage(e.target.value)}
        placeholder="Add your message..."
        style={{ marginBottom: '8px' }}
      />
      <div
        className="action-buttons"
        style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}
      >
        {renderActionButtons()}
      </div>
      <ReassignModal
        visible={reassignModalVisible}
        onCancel={() => setReassignModalVisible(false)}
        onOk={handleReassign}
        loading={actionLoading}
      />
    </div>
  );
};

export default RecordDetailsPage;

'use client';
import React, { useEffect, useState } from 'react';
import { Tabs, Table, Button, Input, Tag, Avatar, Pagination, Row, Col, Typography, Divider, message } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  FilterOutlined,
  DeleteOutlined,
  SyncOutlined,
  ArrowLeftOutlined,
  FileDoneOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import '@/styles/Inbox.css';
import {
  FormattedRecord,
  PendingApproval,
  getApprovalRequests,
  getAllRecords,
  getRecordsByStatus,
  getSpacesByStatus,
  deleteRecord,
  deleteCabinet,
  deleteSpace,
  formatRecord,
  formatSpace,
  formatApprovalRequest,
  formatRecordAsPendingApproval,
  formatSpaceAsPendingApproval,
  getSpacesWaitingForMyApproval,
  getMySpacesByStatus,
  getMyCabinetsByStatus,
  getCabinetsWaitingForMyApproval,
  formatCabinetAsPendingApproval,
  approveCabinet,
  approveSpace,
  approveRecord,
  FormattedCabinet,
  formatCabinet,
  getRecordsWaitingForMyApproval,
  getLettersPendingMyReview,
} from '@/utils/api';
import { API_URL } from '@/app/config';

const { Title } = Typography;

interface PendingLetterReview {
  id: string;
  name: string | null;
  status: string; // e.g., 'pending_review'
  createdAt: string; // Or Date
  template?: { id: string; name: string | null };
  user?: { // Submitter info
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
  };
  // Add other relevant fields returned by the API
}

const formatLetterForReview = (letter: PendingLetterReview): FormattedRecord => {
  const submitter = letter.user;
  const submitterName = submitter ? `${submitter.firstName || ''} ${submitter.lastName || ''}`.trim() || submitter.email : 'Unknown User';
  // You might need a default avatar or fetch it if available
  const submitterAvatar = '/images/avatar.png';

 return {
     key: letter.id, // Use letter ID as key
     id: letter.id,
     description: letter.name || `Letter ${letter.id.substring(0, 6)}...`, // Display letter name
     type: 'Letter', // Clearly identify the type
     sentBy: {
         name: submitterName,
         avatar: submitterAvatar,
     },
     sentOn: new Date(letter.createdAt).toLocaleDateString('az-AZ'), // Format date as needed
     priority: 'Normal', // Determine priority based on rules if needed, default for now
     deadlines: 'N/A', // Add deadline if applicable
     status: letter.status, // Keep status if needed for display/logic
     // Add any other fields required by the 'columns' definition
 };
};

const handleApproveItem = async (record: FormattedRecord) => {
  try {
    if (record.type === 'Cabinet') {
      await approveCabinet(record.id);
      message.success('Cabinet approved successfully');
    } else if (record.type === 'Space') {
      await approveSpace(record.id);
      message.success('Space approved successfully');
    } else if (record.type === 'Record') {
      await approveRecord(record.id);
      message.success('Record approved successfully');
    }
  } catch (error) {
    console.error('Error approving item:', error);
    message.error('Failed to approve item');
  }
};

const handleDeleteItem = async (record: FormattedRecord) => {
  try {
    if (record.type === 'Cabinet') {
      await deleteCabinet(record.id);
      message.success('Cabinet deleted successfully');
      window.location.href = '/dashboard/Inbox';
    } else if (record.type === 'Space') {
      await deleteSpace(record.id);
      message.success('Space deleted successfully');
      window.location.href = '/dashboard/Inbox';
    } else if (record.type === 'Record') {
      await deleteRecord(record.id);
      message.success('Record deleted successfully');
      window.location.href = '/dashboard/Inbox';
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    message.error('Failed to delete item');
  }
};

const handleReassignItem = async (record: FormattedRecord) => {
  try {
    if (record.type === 'Cabinet') {
      window.location.href = `/dashboard/Inbox/Cabinet/${record.id}?action=reassign`;
    } else if (record.type === 'Space') {
      window.location.href = `/dashboard/Inbox/Space/${record.id}?action=reassign`;
    } else if (record.type === 'Record') {
      window.location.href = `/dashboard/Inbox/RecordDetails/${record.id}?action=reassign`;
    }
  } catch (error) {
    console.error('Error reassigning item:', error);
    message.error('Failed to reassign item');
  }
};

const columns = [
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
  },
  {
    title: 'Sent by',
    dataIndex: 'sentBy',
    key: 'sentBy',
    render: (sentBy: any) => (
      <>
        <Avatar src={sentBy?.avatar || '/images/avatar.png'} /> {sentBy?.name || 'Unknown User'}
      </>
    ),
  },
  {
    title: 'Sent on',
    dataIndex: 'sentOn',
    key: 'sentOn',
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    render: (priority: any) => (
      <Tag color={priority === 'High' ? 'red' : priority === 'Med' ? 'orange' : 'green'}>
        {priority}
      </Tag>
    ),
  },
  {
    title: 'Deadlines',
    dataIndex: 'deadlines',
    key: 'deadlines',
  },
  {
    title: 'Actions Required',
    key: 'actions',
    render: (_: any, record: FormattedRecord) => (
      <div className="action-buttons">
        <Button
          icon={<CheckOutlined />}
          type="text"
          className="action-btn checkok"
          onClick={(e) => {
            e.stopPropagation();
            handleApproveItem(record);
          }}
          title="Approve"
        />
        <Button
          icon={<CloseOutlined />}
          type="text"
          className="action-btn closedel"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteItem(record);
          }}
          title="Delete"
        />
        <Button
          icon={<FileDoneOutlined />}
          type="text"
          className="action-btn assignok"
          onClick={(e) => {
            e.stopPropagation();
            handleReassignItem(record);
          }}
          title="Reassign"
        />
      </div>
    ),
  },
];

const rejectedColumns = [
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: any) => {
      const tagColor = typeof status === 'object' ? status.color : 'default';
      const tagLabel = typeof status === 'object' ? status.label : status;
      return <Tag color={tagColor} className="status-tag">{tagLabel}</Tag>;
    },
  },
  {
    title: 'Rejected on',
    dataIndex: 'rejectedOn',
    key: 'rejectedOn',
  },
  {
    title: 'Reason',
    dataIndex: 'reason',
    key: 'reason',
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    render: (priority: string) => (
      <Tag color={priority === 'High' ? 'red' : priority === 'Medium' ? 'orange' : 'green'}>
        {priority}
      </Tag>
    ),
  },
  {
    title: 'Actions Required',
    key: 'actions',
    render: (_: any, record: FormattedRecord) => (
      <div className="action-buttons">
        <Button
          icon={<CheckOutlined />}
          type="text"
          className="action-btn checkok"
          onClick={(e) => {
            e.stopPropagation();
            message.info(`Item with ID ${record.id} was previously rejected.`);
          }}
        />
        <Button
          icon={<CloseOutlined />}
          type="text"
          className="action-btn closedel"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteItem(record);
          }}
        />
        <Button
          icon={<FileDoneOutlined />}
          type="text"
          className="action-btn assignok"
          onClick={(e) => {
            e.stopPropagation();
            handleReassignItem(record);
          }}
        />
      </div>
    ),
  },
];

const InboxPage = () => {
  const router = useRouter();
  const [approvalRequests, setApprovalRequests] = useState<FormattedRecord[]>([]);
  const [recordsWaitingForMyApproval, setRecordsWaitingForMyApproval] = useState<FormattedRecord[]>([]);
  const [pendingSpaces, setPendingSpaces] = useState<FormattedRecord[]>([]);
  const [pendingCabinets, setPendingCabinets] = useState<FormattedRecord[]>([]);
  const [approvedRecords, setApprovedRecords] = useState<FormattedRecord[]>([]);
  const [rejectedRecords, setRejectedRecords] = useState<FormattedRecord[]>([]);
  const [rejectedSpaces, setRejectedSpaces] = useState<FormattedRecord[]>([]);
  const [rejectedCabinets, setRejectedCabinets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingCabinets, setLoadingCabinets] = useState(false);
  const [myPendingRecords, setMyPendingRecords] = useState<PendingApproval[]>([]);
  const [spacesWaitingForMyApproval, setSpacesWaitingForMyApproval] = useState<FormattedRecord[]>([]);
  const [cabinetsWaitingForMyApproval, setCabinetsWaitingForMyApproval] = useState<FormattedRecord[]>([]);
  const [myPendingSpaces, setMyPendingSpaces] = useState<any[]>([]);
  const [myPendingCabinets, setMyPendingCabinets] = useState<any[]>([]);

  const [pendingLettersForReview, setPendingLettersForReview] = useState<FormattedRecord[]>([]); // <-- NEW STATE
  const [loadingLettersReview, setLoadingLettersReview] = useState(false); // <-- NEW LOADING STATE


  useEffect(() => {
    fetchApprovalRequests();
    fetchCabinetsWaitingForMyApproval();
    fetchMyPendingCabinets();
    fetchRejectedCabinet();
    fetchRecordsWaitingForMyApproval();               
    fetchMyPendingRecords();
    fetchRejectedRecord();
    fetchLettersForMyReview();
  }, []);

  const fetchLettersForMyReview = async () => {
    try {
        setLoadingLettersReview(true);
        const letters: PendingLetterReview[] = await getLettersPendingMyReview(); // Call the API
        const formatted = letters.map(formatLetterForReview); // Format the data
        setPendingLettersForReview(formatted);
    } catch (error) {
        // Error is likely already shown by the api function's message.error
        console.error('Error fetching letters for my review:', error);
        setPendingLettersForReview([]); // Clear on error
    } finally {
        setLoadingLettersReview(false);
    }
  };


  const fetchRejectedRecord = async () => {
    try {
      setLoadingRecords(true);
      const records = await getAllRecords('rejected');
      const formatted = records.map(formatRecord);
      const rejected = formatted
        .filter(record => record.status === 'rejected')
        .map(record => ({
          ...record,
        }));
      setRejectedRecords(rejected);
    } catch (error) {
      console.error('Error fetching records:', error);
      message.error('Failed to load records');
    } finally {
      setLoadingRecords(false);
    }

  }

  const fetchRecordsWaitingForMyApproval = async () => {
    try {
      setLoadingRecords(true);
      const records = await getRecordsWaitingForMyApproval();
      const pending = records.map(formatRecord);
      setRecordsWaitingForMyApproval(pending);
    } catch (error) {
      console.error('Error fetching records:', error);
      message.error('Failed to load records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchMyPendingRecords = async () => {
    try {
      setLoading(true);
      const records = await getRecordsByStatus('pending');
      const formatted = records.map(formatRecordAsPendingApproval);
      setMyPendingRecords(formatted);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      message.error('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalRequests = async () => {
    try {
      setLoading(true);
      const requests = await getApprovalRequests();
      const formatted = requests.map(formatApprovalRequest);
      setApprovalRequests(formatted);
    } catch (error) {
      message.error('Failed to fetch approval requests');
      console.error('Error fetching approval requests:', error);
    } finally {
      setLoading(false);
    }
  };


  const fetchPendingSpaces = async () => {
    try {
      setLoadingSpaces(true);
      const spaces = await getSpacesByStatus('pending');
      const formatted = spaces.map(formatSpace);
      setPendingSpaces(formatted);
    } catch (error) {
      console.error('Error fetching pending spaces:', error);
      message.error('Failed to load pending spaces');
    } finally {
      setLoadingSpaces(false);
    }
  };


  const fetchCabinetsWaitingForMyApproval = async () => {
    try {
      setLoadingCabinets(true);
      const cabinets = await getCabinetsWaitingForMyApproval();
      const formatted = cabinets.map((cabinet: any) => ({
        key: cabinet.id,
        id: cabinet.id,
        description: `Cabinet: ${cabinet.name}`,
        type: 'Cabinet',
        sentBy: {
          name: cabinet.createdBy?.name || 'Unknown User',
          avatar: cabinet.createdBy?.avatar || '/images/avatar.png'
        },
        sentOn: new Date(cabinet.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        priority: cabinet.priority || 'Med',
        deadlines: new Date(cabinet.createdAt).toLocaleDateString(),
        status: cabinet.status || 'pending'
      }));
      setCabinetsWaitingForMyApproval(formatted);
    } catch (error) {
      console.error('Error fetching cabinets waiting for my approval:', error);
      message.error('Failed to load cabinets waiting for your approval');
    } finally {
      setLoadingCabinets(false);
    }
  };

  const fetchMyPendingCabinets = async () => {
    try {
      setLoadingCabinets(true);
      const cabinets = await getMyCabinetsByStatus('pending');
      if (cabinets && Array.isArray(cabinets)) {
        setMyPendingCabinets(cabinets);
      } else {
        console.error('Invalid cabinets data received:', cabinets);
        setMyPendingCabinets([]);
      }
    } catch (error) {
      console.error('Error fetching my pending cabinets:', error);
      message.error('Failed to load your pending cabinets');
      setMyPendingCabinets([]);
    } finally {
      setLoadingCabinets(false);
    }
  };


  const fetchRejectedCabinet = async () => {
    try {
      setLoadingCabinets(true);
      const cabinets = await getMyCabinetsByStatus('rejected');
      if (cabinets && Array.isArray(cabinets)) {
        //console.log('Rejected cabinets:', cabinets);
        setRejectedCabinets(cabinets);
      } else {
        console.error('Invalid cabinets rejected data received:', cabinets);
        setRejectedCabinets([]);
      }
    } catch (error) {
      console.error('Error fetching my rejected cabinets:', error);
      message.error('Failed to load your rejected cabinets');
      setRejectedCabinets([]);
    } finally {
      setLoadingCabinets(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      await deleteRecord(recordId);
      message.success('Record deleted successfully');
      fetchMyPendingRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      message.error('Failed to delete record');
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    try {
      await deleteSpace(spaceId);
      message.success('Space deleted successfully');
      fetchPendingSpaces();
    } catch (error) {
      console.error('Error deleting space:', error);
      message.error('Failed to delete space');
    }
  };

  const handleDeleteCabinet = async (cabinetId: string) => {
    try {
      await deleteCabinet(cabinetId);
      message.success('Cabinet deleted successfully');
      fetchCabinetsWaitingForMyApproval();
      fetchMyPendingCabinets();
    } catch (error) {
      console.error('Error deleting cabinet:', error);
      message.error('Failed to delete cabinet');
    }
  };

  const onRecordClick = (record: FormattedRecord) => {
    router.push(`/dashboard/Inbox/RecordDetails/${record.id}`);
  };

  const onLetterReviewClick = (record: FormattedRecord) => {
    router.push(`/dashboard/Inbox/LetterReview/${record.id}`);
  };
  const onUserAccessClick = (record: FormattedRecord) => {
    router.push(`/dashboard/Inbox/UserAccess/${record.key}`);
  };

  const onSpaceClick = (record: FormattedRecord | PendingApproval) => {
    const spaceId = record.id || record.key;
    router.push(`/dashboard/Inbox/Space/${spaceId}`);
  };

  const onCabinetClick = (record: FormattedRecord | PendingApproval) => {
    const cabinetId = record.id || record.key;
    router.push(`/dashboard/Inbox/Cabinet/${cabinetId}`);
  };

  const pendingApprovalsColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string, record: PendingApproval) => (
        <div
          key={record.id}
          onClick={() => {
            if (description.startsWith('Space:')) {
              onSpaceClick(record);
            } else if (description.startsWith('Cabinet:')) {
              onCabinetClick(record);
            } else {
              onRecordClick(record as any);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {description}
        </div>
      ),
    },
    {
      title: 'Reference #',
      dataIndex: 'reference',
      key: 'reference',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={priority === 'High' ? 'red' : priority === 'Medium' ? 'orange' : 'green'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Deadline',
      dataIndex: 'deadline',
      key: 'deadline',
    },
    {
      title: 'Sent By',
      dataIndex: 'sentBy',
      key: 'sentBy',
      render: (sentBy: { name: string; avatar: string }) => (
        <>
          <Avatar src={sentBy?.avatar || '/images/avatar.png'} /> {sentBy?.name || 'Unknown User'}
        </>
      ),
    },
    {
      title: 'Status Tracker',
      key: 'statusTracker',
      render: (_: unknown, record: PendingApproval) => (
        <div className="status-tracker" key={`status-tracker-${record.id}`}>
          <Button
            key={`file-done-${record.id}`}
            icon={<FileDoneOutlined />}
            type="text"
            className="status-btn check-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (record.description?.startsWith('Space:')) {
                router.push(`/dashboard/Inbox/Space/${record.id}?action=approve`);
              } else if (record.description?.startsWith('Cabinet:')) {
                router.push(`/dashboard/Inbox/Cabinet/${record.id}?action=approve`);
              } else {
                router.push(`/dashboard/Inbox/RecordDetails/${record.id}?action=approve`);
              }
            }}
            title="Approve"
          />
          <Divider key={`divider1-${record.id}`} type="horizontal" />
          <Button
            key={`check-${record.id}`}
            icon={<CheckOutlined />}
            type="text"
            className="status-btn check-btncheck"
          />
          <Divider key={`divider2-${record.id}`} type="horizontal" />
          <Button
            key={`circle-${record.id}`}
            icon={<CheckCircleOutlined />}
            type="text"
            className="status-btn close-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (record.description?.startsWith('Space:')) {
                router.push(`/dashboard/Inbox/Space/${record.id}?action=reject`);
              } else if (record.description?.startsWith('Cabinet:')) {
                router.push(`/dashboard/Inbox/Cabinet/${record.id}?action=reject`);
              } else {
                router.push(`/dashboard/Inbox/RecordDetails/${record.id}?action=reject`);
              }
            }}
            title="Reject"
          />
          <Divider key={`divider3-${record.id}`} type="horizontal" />
          <Button
            key={`sync-${record.id}`}
            icon={<SyncOutlined />}
            type="text"
            className="status-btn sync-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (record.description?.startsWith('Space:')) {
                router.push(`/dashboard/Inbox/Space/${record.id}?action=reassign`);
              } else if (record.description?.startsWith('Cabinet:')) {
                router.push(`/dashboard/Inbox/Cabinet/${record.id}?action=reassign`);
              } else {
                router.push(`/dashboard/Inbox/RecordDetails/${record.id}?action=reassign`);
              }
            }}
            title="Reassign"
          />
          <Divider key={`divider4-${record.id}`} type="horizontal" />
          <Button
            key={`delete-${record.id}`}
            icon={<DeleteOutlined />}
            type="text"
            className="status-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (record.description?.startsWith('Space:')) {
                handleDeleteSpace(record.id);
              } else if (record.description?.startsWith('Cabinet:')) {
                handleDeleteCabinet(record.id);
              } else {
                handleDelete(record.id);
              }
            }}
            title="Delete"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="inbox-page">
      <div className="header-section">
        <Button
          className="back-button"
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => router.back()}
        />
        <Title level={2} className="page-title">Inbox</Title>
      </div>
      <Row justify="space-between" align="middle" className="inbox-header">
        <Col>
          <Button icon={<FilterOutlined />}>Filters</Button>
          <Input
            placeholder="Search here"
            prefix={<SearchOutlined />}
            className="search-input"
          />
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="1"
        className="custom-tabs"
        items={[
          {
            key: '1',
            label: 'My Approvals',
            children: (
              <Table
                dataSource={[
                  ...recordsWaitingForMyApproval,
                  ...spacesWaitingForMyApproval,
                  ...cabinetsWaitingForMyApproval,
                  ...pendingLettersForReview
                ]}
                columns={columns}
                pagination={false}
                rowSelection={{ type: 'checkbox' }}
                loading={loading || loadingRecords || loadingSpaces || loadingCabinets || loadingLettersReview}
                onRow={(record) => ({
                  onClick: () =>
                    record.type === 'Record'
                      ? onRecordClick(record)
                      : record.type === 'Cabinet'
                        ? onCabinetClick(record)
                        : record.type === 'Letter'
                          ? onLetterReviewClick(record)
                          : onUserAccessClick(record),
                })}
              />
            ),
          },
          {
            key: '2',
            label: 'Pending Approvals',
            children: (
              <Table
                dataSource={[
                  ...myPendingRecords,
                  ...(myPendingSpaces && myPendingSpaces.length > 0
                    ? myPendingSpaces
                        .filter(space => space && space.id)
                        .map(space => {
                          try {
                            return formatSpaceAsPendingApproval(space) as PendingApproval;
                          } catch (error) {
                            console.error('Error formatting space:', error, space);
                            return null;
                          }
                        })
                        .filter(Boolean) as PendingApproval[]
                    : []),
                  ...(myPendingCabinets && myPendingCabinets.length > 0
                    ? myPendingCabinets
                        .filter(cabinet => cabinet && cabinet.id)
                        .map(cabinet => {
                          try {
                            return formatCabinetAsPendingApproval(cabinet) as PendingApproval;
                          } catch (error) {
                            console.error('Error formatting cabinet:', error, cabinet);
                            return null;
                          }
                        })
                        .filter(Boolean) as PendingApproval[]
                    : []),
                ]}
                columns={pendingApprovalsColumns}
                pagination={false}
                rowSelection={{ type: 'checkbox' }}
                loading={loadingRecords || loadingSpaces || loadingCabinets}
                rowKey="id"
                onRow={(record) => ({
                  onClick: () => {
                    if (record.description?.startsWith('Space:')) {
                      onSpaceClick(record);
                    } else if (record.description?.startsWith('Cabinet:')) {
                      onCabinetClick(record);
                    } else {
                      onRecordClick(record as any);
                    }
                  },
                })}
              />
            ),
          },
          {
            key: '3',
            label: 'Rejected',
            children: (
              <Table
                dataSource={[...rejectedRecords, ...rejectedSpaces, 
                  ...(rejectedCabinets && rejectedCabinets.length > 0
                    ? rejectedCabinets
                        .filter(cabinet => cabinet && cabinet.id)
                        .map(cabinet => {
                          try {
                            return formatCabinet(cabinet) as FormattedCabinet;
                          } catch (error) {
                            console.error('Error formatting cabinet:', error, cabinet);
                            return null;
                          }
                        })
                        .filter(Boolean) as FormattedCabinet[]
                    : []),
                  ]}
                columns={rejectedColumns}
                pagination={false}
                rowSelection={{ type: 'checkbox' }}
                loading={loadingRecords || loadingSpaces || loadingCabinets}
                rowKey="id"
                onRow={(record) => ({
                  onClick: () => {
                    if (record.description?.startsWith('Space:')) {
                      onSpaceClick(record);
                    } else if (record.description?.startsWith('Cabinet:') || record.type === 'Cabinet') {
                      onCabinetClick(record);
                    } else {
                      onRecordClick(record as any);
                    }
                  },
                })}
              />
            ),
          },
        ]}
      />

      <div className="footer-section">
        <Pagination className="pagination" defaultCurrent={1} total={50} showSizeChanger={false} />
      </div>
    </div>
  );
};

export default InboxPage;
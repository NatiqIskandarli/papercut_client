'use client';
import React, { useEffect, useState } from 'react';
import { Tabs, Table, Button, Input, Tag, Avatar, Pagination, Row, Col, Typography, Divider, message, Space, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  FilterOutlined,
  DeleteOutlined,
  SyncOutlined,
  ArrowLeftOutlined,
  FileDoneOutlined,
  CheckCircleOutlined,
  SendOutlined // Added for Reassign
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import '@/styles/Inbox.css';
import {
  getLettersPendingMyAction,
  getMyRejectedLettersApi,
  LetterWorkflowStatus
} from '@/utils/api';

const { Title } = Typography;

interface PendingLetter {
  id: string;
  name: string | null;
  workflowStatus: LetterWorkflowStatus;
  createdAt: string;
  updatedAt: string;
  originalPdfFileId: string | null;
  template?: { id: string; name: string | null };
  user?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      avatar?: string;
  };
  letterActionLogs?: Array<{ comment: string | null; createdAt: string }> | null;
}

interface FormattedRecord {
    key: string;
    id: string;
    description: string;
    type: string;
    sentBy: { name: string; avatar: string };
    sentOn: string;
    priority: string;
    deadlines: string;
    status: any; 
    workflowStatus?: LetterWorkflowStatus;
    rejectedOn?: string;
    reason?: string;
}


const formatLetterForAction = (letter: PendingLetter): FormattedRecord => {
  const submitter = letter.user;
  const submitterName = submitter ? `${submitter.firstName || ''} ${submitter.lastName || ''}`.trim() || submitter.email : 'Unknown User';
  const submitterAvatar = submitter && submitter.avatar ? submitter.avatar : '/images/avatar.png';

 return {
     key: letter.id,
     id: letter.id,
     description: letter.name || `Letter ${letter.id.substring(0, 6)}...`,
     type: letter.originalPdfFileId === null ? 'Letter' : 'Letter (PDF)',
     sentBy: { name: submitterName, avatar: submitterAvatar },
     sentOn: new Date(letter.createdAt).toLocaleDateString('az-AZ'),
     priority: 'Normal',
     deadlines: 'N/A',
     status: letter.workflowStatus,
     workflowStatus: letter.workflowStatus // Pass the specific status
 };
};


const formatRejectedLetter = (letter: PendingLetter): FormattedRecord => {
    const latestRejectionLog = letter.letterActionLogs?.[0];
    const rejectionReason = latestRejectionLog?.comment || 'No reason provided.';
    const rejectionDate = latestRejectionLog?.createdAt || letter.updatedAt;

    return {
        key: letter.id,
        id: letter.id,
        description: letter.name || `Letter ${letter.id.substring(0, 6)}...`,
        status: { label: 'Rejected', color: 'error' },
        rejectedOn: new Date(rejectionDate).toLocaleDateString('az-AZ'),
        reason: rejectionReason,
        type: letter.originalPdfFileId === null ? 'Letter' : 'Letter (PDF)',
        priority: 'N/A',
        workflowStatus: letter.workflowStatus,
        sentBy: { name: '', avatar: ''},
        sentOn: '',
        deadlines: '',
    };
};

const InboxPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingLettersForAction, setPendingLettersForAction] = useState<FormattedRecord[]>([]);
  const [loadingLettersAction, setLoadingLettersAction] = useState(false);
  const [rejectedLetters, setRejectedLetters] = useState<FormattedRecord[]>([]);
  const [loadingRejected, setLoadingRejected] = useState(false);

  useEffect(() => {
    fetchLettersForMyAction();
    fetchMyRejectedLetters();
  }, []);

  const fetchLettersForMyAction = async () => {
    try {
        setLoadingLettersAction(true);
        const letters: PendingLetter[] = await getLettersPendingMyAction();

        const formatted = letters.map(formatLetterForAction);
        setPendingLettersForAction(formatted);
    } catch (error) {
        console.error('Error fetching letters for my action:', error);
        setPendingLettersForAction([]);
        message.error("Failed to load letters needing your action.");
    } finally {
        setLoadingLettersAction(false);
    }
  };

  const fetchMyRejectedLetters = async () => {
      setLoadingRejected(true);
      try {
          const letters: PendingLetter[] = await getMyRejectedLettersApi();
          const formatted = letters.map(formatRejectedLetter);
          setRejectedLetters(formatted);
      } catch (error) {
          console.error('Error fetching rejected letters:', error);
          setRejectedLetters([]);
          message.error("Failed to load rejected letters.");
      } finally {
          setLoadingRejected(false);
      }
  };

  const handleActionClick = (record: FormattedRecord, action: 'approve' | 'reject' | 'reassign' | 'final_approve' | 'final_reject') => {
    const reviewPagePath = record.type === 'Letter'
        ? `/dashboard/Inbox/LetterReview/${record.id}`
        : `/dashboard/Inbox/LetterPdfReview/${record.id}`;

    router.push(`${reviewPagePath}?action=${action}`);
  };

    const onLetterActionClick = (record: FormattedRecord) => {
        const reviewPagePath = record.type === 'Letter'
            ? `/dashboard/Inbox/LetterReview/${record.id}`
            : `/dashboard/Inbox/LetterPdfReview/${record.id}`;

        router.push(reviewPagePath);
    };


  const onRejectedLetterClick = (record: FormattedRecord) => {
        const reviewPagePath = record.type === 'Letter'
            ? `/dashboard/Inbox/LetterReview/${record.id}`
            : `/dashboard/Inbox/LetterPdfReview/${record.id}`;

       router.push(reviewPagePath);
  };

   const myApprovalsColumns = [
    { title: 'Description', dataIndex: 'description', key: 'description', },
    { title: 'Type', dataIndex: 'type', key: 'type', },
    { title: 'Sent by', dataIndex: 'sentBy', key: 'sentBy', render: (sentBy: any) => (<><Avatar src={sentBy?.avatar || '/images/avatar.png'} /> {sentBy?.name || 'Unknown User'}</>), },
    { title: 'Sent on', dataIndex: 'sentOn', key: 'sentOn', },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (priority: any) => (<Tag color={priority === 'High' ? 'red' : priority === 'Med' ? 'orange' : 'green'}>{priority}</Tag>), },
    { title: 'Deadlines', dataIndex: 'deadlines', key: 'deadlines', },
    {
        title: 'Actions Required',
        key: 'actions',
        render: (_: any, record: FormattedRecord) => {
            if (record.workflowStatus === LetterWorkflowStatus.PENDING_REVIEW) {
                return (
                    <Space className="action-buttons">
                        <Tooltip title="Approve Step">
                             <Button icon={<CheckOutlined />} type="text" className="action-btn checkok" onClick={(e) => { e.stopPropagation(); handleActionClick(record, 'approve'); }} />
                        </Tooltip>
                        <Tooltip title="Reject Step">
                            <Button icon={<CloseOutlined />} type="text" className="action-btn closedel" onClick={(e) => { e.stopPropagation(); handleActionClick(record, 'reject'); }} />
                        </Tooltip>
                        <Tooltip title="Reassign Step">
                            <Button icon={<SendOutlined />} type="text" className="action-btn assignok" onClick={(e) => { e.stopPropagation(); handleActionClick(record, 'reassign'); }} />
                        </Tooltip>
                    </Space>
                );
            } else if (record.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL) {
                 return (
                    <Space className="action-buttons">
                        <Tooltip title="Final Approve">
                            <Button icon={<CheckCircleOutlined />} type="text" className="action-btn checkok" onClick={(e) => { e.stopPropagation(); handleActionClick(record, 'final_approve'); }} />
                        </Tooltip>
                         <Tooltip title="Final Reject">
                            <Button icon={<CloseOutlined />} type="text" className="action-btn closedel" onClick={(e) => { e.stopPropagation(); handleActionClick(record, 'final_reject'); }} />
                        </Tooltip>
                    </Space>
                );
            }
            return null; // Or some default text if status is unexpected
        },
    },
  ];

  const rejectedColumns = [
    { title: 'Description', dataIndex: 'description', key: 'description', },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: any) => (<Tag color={status?.color || 'default'} className="status-tag">{status?.label || status || 'Unknown'}</Tag>), },
    { title: 'Rejected on', dataIndex: 'rejectedOn', key: 'rejectedOn', },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: 'Type', dataIndex: 'type', key: 'type', },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (priority: string) => (<Tag color={priority === 'High' ? 'red' : priority === 'Medium' ? 'orange' : 'green'}>{priority}</Tag>), },
    { title: 'Actions Required', key: 'actions', render: (_: any, record: FormattedRecord) => ( <div className="action-buttons"> <Tooltip title="Resubmit/View Details"><Button icon={<SyncOutlined />} type="text" className="action-btn assignok" onClick={(e) => { e.stopPropagation(); onRejectedLetterClick(record); }} /></Tooltip> <Tooltip title="Delete"><Button icon={<DeleteOutlined />} type="text" className="action-btn closedel" onClick={(e) => { e.stopPropagation(); message.warning("Delete not implemented") /* TODO */ }} /></Tooltip> </div> ), },
  ];

  return (
    <div className="inbox-page">
      <div className="header-section">
        <Button className="back-button" icon={<ArrowLeftOutlined />} type="text" onClick={() => router.back()} />
        <Title level={2} className="page-title">Inbox</Title>
      </div>
      <Row justify="space-between" align="middle" className="inbox-header">
        <Col>
          <Button icon={<FilterOutlined />}>Filters</Button>
          <Input placeholder="Search here" prefix={<SearchOutlined />} className="search-input" />
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
                dataSource={pendingLettersForAction}
                columns={myApprovalsColumns}
                pagination={false}
                rowSelection={{ type: 'checkbox' }}
                loading={loadingLettersAction}
                onRow={(record) => ({
                  onClick: () => onLetterActionClick(record),
                  style: { cursor: 'pointer' },
                })}
              />
            ),
          },
          {
            key: '2',
            label: 'Pending Approvals',
            children: (
              <Table dataSource={[]} columns={[]} pagination={false} rowSelection={{ type: 'checkbox' }} loading={loading} rowKey="id" />
            ),
          },
          {
            key: '3',
            label: 'Rejected',
            children: (
              <Table
                dataSource={rejectedLetters}
                columns={rejectedColumns}
                pagination={false}
                rowSelection={{ type: 'checkbox' }}
                loading={loadingRejected}
                rowKey="id"
                onRow={(record) => ({
                  onClick: () => onRejectedLetterClick(record),
                  style: { cursor: 'pointer' },
                })}
              />
            ),
          },
        ]}
      />

      <div className="footer-section">
        <Pagination className="pagination" defaultCurrent={1} total={pendingLettersForAction.length} showSizeChanger={false} />
      </div>
    </div>
  );
};

export default InboxPage;
'use client';
import React, { useState, useEffect } from 'react';
import { Tabs, Button, Table, Typography, Spin, message, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import '@/styles/MyStaff.css';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/app/config';
import Dashboard from '@/components/DashboardPaperCut';

const AntTable = Table;
const { Title } = Typography;

interface Letter {
  key: string;
  id: string;
  name?: string | null;
  templateId?: string | null;
  signedPdfUrl?: string | null;
  createdAt: string;
  template?: {
      id: string;
      name: string;
  } | null;
  workflowStatus?: string;
}

const MyStaffPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("1");
  const [loading, setLoading] = useState(false);
  const [myLetters, setMyLetters] = useState<Letter[]>([]);
  const [draftRecords, setDraftRecords] = useState([]); // Hələlik saxlanılır

  useEffect(() => {
    if (activeTab === "1") {
      fetchMyLetters();
    } else if (activeTab === "2") {
      // fetchDraftRecords(); // Lazım olarsa aktivləşdirin və /letters endpointinə uyğunlaşdırın
    }
  }, [activeTab]);

    const fetchMyLetters = async () => {    setLoading(true);    try {      const response = await fetch(`${API_URL}/letters`, {        credentials: 'include',        headers: {          'Content-Type': 'application/json'        },      });      if (!response.ok) {         const errorData = await response.json().catch(() => ({ message: 'Failed to fetch letters' }));         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);      }      const data = await response.json();      const formattedLetters = data.map((letter: any): Letter => ({        key: letter.id,        id: letter.id,        name: letter.name ?? (letter.template ? `From: ${letter.template.name}` : 'Signed PDF Document'),        templateId: letter.templateId,        signedPdfUrl: letter.signedPdfUrl,        createdAt: new Date(letter.createdAt).toLocaleDateString('en-GB', {          year: 'numeric', month: 'short', day: 'numeric',          hour: '2-digit', minute: '2-digit'        }),        template: letter.template ? { id: letter.template.id, name: letter.template.name } : null,        workflowStatus: letter.workflowStatus      }));      setMyLetters(formattedLetters);    } catch (error: any) {      console.error('Error fetching letters:', error);      message.error(`Failed to load letters: ${error.message}`);      setMyLetters([]);    } finally {      setLoading(false);    }  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const handleViewLetter = (letterId: string) => {
    router.push(`/dashboard/letters/view/${letterId}`);
  };

    const letterColumns: ColumnsType<Letter> = [
    {
        title: 'Type',
        key: 'type',
        width: 50,
        render: (_, record) => (
             <Tooltip title={record.signedPdfUrl ? 'Signed PDF Document' : 'Template Based Letter'}>
                {record.signedPdfUrl ? <FilePdfOutlined style={{fontSize: '18px', color: '#FF5733'}} /> : <FileTextOutlined style={{fontSize: '18px', color: '#337BFF'}} />}
             </Tooltip>
        )
    },
    {
      title: 'Letter Name / Source',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => name || 'Untitled Letter'
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        let color = 'default';
        let text = record.workflowStatus || 'Unknown';
        
        switch(record.workflowStatus) {
          case 'approved':
            color = 'green';
            text = 'Approved';
            break;
          case 'pending_review':
            color = 'blue';
            text = 'Pending Review';
            break;
          case 'pending_approval':
            color = 'orange';
            text = 'Pending Approval';
            break;
          case 'rejected':
            color = 'red';
            text = 'Rejected';
            break;
          case 'draft':
            color = 'default';
            text = 'Draft';
            break;
        }
        
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
    },
     {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={(e) => { e.stopPropagation(); handleViewLetter(record.id); }}>
          View
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      label: "My Letters",
      key: "1",
      children: (
        <Spin spinning={loading}>
             <AntTable<Letter>
                columns={letterColumns}
                dataSource={myLetters}
                rowKey="id"
                pagination={{ pageSize: 10, size: 'small' }}
                onRow={(record) => ({
                    onClick: () => handleViewLetter(record.id),
                    style: { cursor: 'pointer' }
                })}
                size="small"
            />
        </Spin>
    )},
    {
      label: "My Drafts",
      key: "2",
      children: (
         <Spin spinning={loading}>
            <AntTable dataSource={draftRecords} columns={[]} />
         </Spin>
    ) },
  ];

  return (
    <div className="my-staff-page">
      <div className="header-section">
        <Button
            className="back-button"
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => router.back()}
            >
        </Button>
        <Title level={2} className="page-title">My Staff</Title>
      </div>

      <Dashboard />

      <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} className="records-tabs" />

    </div>
  );
};

export default MyStaffPage;
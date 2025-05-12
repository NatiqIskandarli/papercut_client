'use client';

import React, { useState, useEffect, useMemo, Fragment, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_URL } from '@/app/config';
import { message, Spin, Card, Typography, Button, Alert, Modal, Tag, Divider, Select, Avatar, Empty, Checkbox, Table, Tooltip } from 'antd'; 
import { ExclamationCircleOutlined, DeleteOutlined, LeftOutlined, SaveOutlined, ShareAltOutlined } from '@ant-design/icons';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import axios from 'axios';
import CkeditorOzel from '../../../CreateLetter/ckeditor_letter';

interface TemplateData {
    id: string;
    name?: string | null;
    content: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

interface TemplateField {
    id: string;
    type: string;
    label: string;
}

interface ReviewerUser {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string | null;
}

interface ShareHistoryEntry {
    id: string;
    sharedAt: string;
    sharedByUser: { id: string; firstName: string; lastName: string; avatar?: string | null; };
    sharedWithUser: { id: string; firstName: string; lastName: string; avatar?: string | null; };
}

const fieldMappings = [
    { formField: 'company', templateField: 'company-1', type: 'dropdown', source: 'companies' },
    { formField: 'date', templateField: 'date-1', type: 'date' },
    { formField: 'customs', templateField: 'customs-1', type: 'dropdown', source: 'customs' },
    { formField: 'vendor', templateField: 'vendor-1', type: 'dropdown', source: 'vendors' },
    { formField: 'contract', templateField: 'contract-1', type: 'dropdown', source: 'contracts' },
    { formField: 'value', templateField: 'amount-1', type: 'number' },
    { formField: 'invoiceNumber', templateField: 'invoice-number', type: 'text' },
    { formField: 'cargoName', templateField: 'cargo-name', type: 'text' },
    { formField: 'cargoDescription', templateField: 'cargo-description', type: 'text' },
    { formField: 'documentType', templateField: 'document-type', type: 'dropdown', source: 'documentTypes' },
    { formField: 'importPurpose', templateField: 'import-purpose', type: 'text' },
    { formField: 'requestPerson', templateField: 'request-person', type: 'text' },
    { formField: 'requestDepartment', templateField: 'request-department', type: 'text' },
    { formField: 'person', templateField: 'person', type: 'text' },
    { formField: 'subContractorName', templateField: 'subcontractor-name', type: 'dropdown', source: 'subContractorNames' },
    { formField: 'subContractNumber', templateField: 'subcontract-number', type: 'text' },
];

const templateFields: TemplateField[] = fieldMappings.map(mapping => ({
    id: mapping.templateField,
    type: mapping.type,
    label: mapping.formField.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
}));

const getAuthHeaders = () => {
    return {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        withCredentials: true,
    };
};

async function fetchTemplateById(id: string): Promise<TemplateData> {
     const config = getAuthHeaders();
     const response = await axios.get(`${API_URL}/templates/${id}`, config);
     return response.data;
}

async function deleteTemplateApi(id: string): Promise<void> {
    const config = getAuthHeaders();
    await axios.delete(`${API_URL}/templates/${id}`, config);
}

async function fetchReviewers(templateId: string): Promise<ReviewerUser[]> {
    const config = getAuthHeaders();
    try {
        const response = await axios.get(`${API_URL}/templates/${templateId}/reviewers`, config);
        return (response.data && Array.isArray(response.data)) ? response.data : [];
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
             return [];
        }
        throw error;
    }
}

async function fetchAllUsersApi(): Promise<ReviewerUser[]> {
    const config = getAuthHeaders();
    try {
        const response = await axios.get(`${API_URL}/users/list`, config);
        const usersData = response.data?.users || response.data || [];
        return usersData.map((user: any) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar
        })).filter((user: ReviewerUser) => user.id);
    } catch (error) {
        throw error;
    }
}

async function updateReviewers(templateId: string, reviewerUserIds: string[]): Promise<void> {
    const config = getAuthHeaders();
    await axios.put(`${API_URL}/templates/${templateId}/reviewers`, { reviewerUserIds }, config);
}

async function shareTemplateApi(templateId: string, userIds: string[]): Promise<void> {
    const config = getAuthHeaders();
    await axios.post(`${API_URL}/templates/${templateId}/share`, { userIds }, config);
}

async function fetchShareHistoryApi(templateId: string): Promise<ShareHistoryEntry[]> {
    const config = getAuthHeaders();
    try {
        const response = await axios.get(`${API_URL}/templates/${templateId}/share-history`, config);
        return response.data || [];
    } catch (error) {
        throw error;
    }
}

async function deleteShareRecordApi(shareId: string): Promise<void> {
    const config = getAuthHeaders();
    await axios.delete(`${API_URL}/templates/shares/${shareId}`, config);
}

function ViewTemplateContent() {
    const [templateData, setTemplateData] = useState<TemplateData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [allUsers, setAllUsers] = useState<ReviewerUser[]>([]);
    const [isFetchingAllUsers, setIsFetchingAllUsers] = useState(false);

    const [currentReviewers, setCurrentReviewers] = useState<ReviewerUser[]>([]);
    const [isFetchingReviewers, setIsFetchingReviewers] = useState(false);

    const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
    const [isSavingReviewers, setIsSavingReviewers] = useState(false);

    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [shareUserIds, setShareUserIds] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);

    const [shareHistory, setShareHistory] = useState<ShareHistoryEntry[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    const [deletingShareId, setDeletingShareId] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const templateId = searchParams.get('templateId');

    useEffect(() => {
        setTemplateData(null);
        setError(null);
        setIsLoading(true);
        setCurrentReviewers([]);
        setSelectedReviewerIds([]);
        setAllUsers([]);
        setIsFetchingReviewers(false);
        setIsFetchingAllUsers(false);
        setShareHistory([]);
        setIsFetchingHistory(false);

        if (templateId) {
            const loadData = async () => {
                try {
                    const fetchedTemplate = await fetchTemplateById(templateId);
                    setTemplateData(fetchedTemplate);

                    setIsFetchingReviewers(true);
                    setIsFetchingAllUsers(true);

                    const reviewersPromise = fetchReviewers(templateId);
                    const allUsersPromise = fetchAllUsersApi();
                    const historyPromise = fetchShareHistoryApi(templateId);

                    const [fetchedReviewers, fetchedAllUsers, fetchedHistory] = await Promise.all([
                        reviewersPromise,
                        allUsersPromise,
                        historyPromise
                    ]);

                    const assignedReviewers = fetchedReviewers || [];
                    setCurrentReviewers(assignedReviewers);
                    setSelectedReviewerIds(assignedReviewers.map(r => r.id));

                    setAllUsers(fetchedAllUsers || []);
                    setShareHistory(fetchedHistory || []);

                } catch (err: any) {
                    const errMsg = err.response?.data?.error || err.message || 'Məlumatları yükləyərkən xəta baş verdi.';
                    setError(errMsg);
                    message.error(errMsg);
                } finally {
                    setIsLoading(false);
                    setIsFetchingReviewers(false);
                    setIsFetchingAllUsers(false);
                    setIsFetchingHistory(false);
                }
            };
            loadData();
        } else {
             const msg = "URL-də şablon ID-si tapılmadı.";
             setError(msg);
             setIsLoading(false);
             message.warning(msg);
        }
    }, [templateId]);

    const renderContentWithLabels = (text: string): string => {
        if (!text) return '';
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1);
                const field = templateFields.find(f => f.id === fieldId);
                if (field) {
                    return `<span class="ant-tag ant-tag-processing mx-0.5 text-xs font-sans">[${field.label}]</span>`;
                } else {
                    return `<span class="ant-tag ant-tag-error mx-0.5 text-xs font-sans">[${fieldId}?]</span>`;
                }
            }
            return part.replace(/\n/g, '<br/>');
        }).join('');
    };

    const handleDelete = () => {
        if (!templateId) return;
        Modal.confirm({
            title: 'Şablonu silməyə əminsiniz?',
            icon: <ExclamationCircleOutlined />,
            content: `"${templateData?.name || `ID: ${templateId.substring(0,8)}...`}" adlı şablon birdəfəlik silinəcək.`,
            okText: 'Bəli, Sil', okType: 'danger', cancelText: 'Ləğv et', centered: true, maskClosable: true,
            onOk: async () => {
                setIsDeleting(true); const key = 'deleting'; message.loading({ content: 'Şablon silinir...', key });
                try {
                    await deleteTemplateApi(templateId);
                    message.success({ content: 'Şablon uğurla silindi!', key, duration: 2 });
                    router.push('/dashboard/Templates/Created');
                } catch (err: any) {
                    message.error({ content: err.response?.data?.error || err.message || 'Şablon silinərkən xəta.', key, duration: 4 });
                    setIsDeleting(false);
                }
            },
            onCancel: () => { setIsDeleting(false); }
        });
    };

    const handleSaveReviewers = async () => {
        if (!templateId) return;
        setIsSavingReviewers(true);
        const key = 'savingReviewers';
        message.loading({ content: 'Reviewer-lər yadda saxlanılır...', key });
        try {
            await updateReviewers(templateId, selectedReviewerIds);
            const updatedReviewers = await fetchReviewers(templateId);
            setCurrentReviewers(updatedReviewers || []);
            setSelectedReviewerIds((updatedReviewers || []).map(r => r.id));
            message.success({ content: 'Reviewer-lər uğurla yadda saxlanıldı!', key, duration: 3 });
        } catch (err: any) {
            message.error({ content: err.response?.data?.error || err.message || 'Reviewer-ləri yadda saxlayarkən xəta.', key, duration: 4 });
        } finally {
            setIsSavingReviewers(false);
        }
    };

    const handleDeleteShare = (shareEntry: ShareHistoryEntry) => {
        if (!templateId) return;
        const sharedWithUserName = `${shareEntry.sharedWithUser.firstName || ''} ${shareEntry.sharedWithUser.lastName || ''}`.trim() || 'bu istifadəçi';
        Modal.confirm({
            title: 'Paylaşmanı Sil',
            icon: <ExclamationCircleOutlined />,
            content: `"${sharedWithUserName}" ilə olan paylaşmanı silməyə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.`,
            okText: 'Bəli, Sil',
            okType: 'danger',
            cancelText: 'Ləğv et',
            centered: true,
            maskClosable: true,
            onOk: async () => {
                setDeletingShareId(shareEntry.id);
                const key = `deletingShare_${shareEntry.id}`;
                message.loading({ content: 'Paylaşma silinir...', key, duration: 0 });
                try {
                    await deleteShareRecordApi(shareEntry.id);
                    message.success({ content: 'Paylaşma uğurla silindi!', key, duration: 2 });
                    setShareHistory(prevHistory => prevHistory.filter(item => item.id !== shareEntry.id));
                } catch (err: any) {
                    let errorMsg = 'Paylaşma silinərkən xəta.';
                    if (err.response?.data?.error) { errorMsg = err.response.data.error; }
                    else if (err.message) { errorMsg = err.message; }
                    message.error({ content: errorMsg, key, duration: 4 });
                } finally {
                    message.destroy(key);
                    setDeletingShareId(null);
                }
            },
            onCancel: () => {}
        });
    };

    const handleOpenShareModal = () => {
        setShareUserIds([]);
        setIsShareModalVisible(true);
    };

    const handleCloseShareModal = () => {
        setIsShareModalVisible(false);
    };

    const handleShareTemplate = async () => {
        if (!templateId || shareUserIds.length === 0) {
            message.warning('Zəhmət olmasa, paylaşmaq üçün ən azı bir istifadəçi seçin.');
            return;
        }
        setIsSharing(true);
        const key = 'sharingTemplate';
        message.loading({ content: 'Şablon paylaşılır...', key });
        try {
            await shareTemplateApi(templateId, shareUserIds);
            message.success({ content: 'Şablon uğurla paylaşıldı!', key, duration: 3 });
            setIsShareModalVisible(false);
            setIsFetchingHistory(true);
            try {
                const updatedHistory = await fetchShareHistoryApi(templateId);
                setShareHistory(updatedHistory || []);
            } catch (historyError) {
                message.error('Tarixçə yenilənərkən xəta baş verdi.');
            } finally {
                setIsFetchingHistory(false);
            }
        } catch (err: any) {
            let errorMsg = 'Şablon paylaşılarkən xəta.';
            if (err.response?.data?.error) { errorMsg = err.response.data.error; }
            else if (err.message) { errorMsg = err.message; }
            message.error({ content: errorMsg, key, duration: 4 });
        } finally {
            setIsSharing(false);
        }
    };

    const allUserIds = useMemo(() => allUsers.map(u => u.id), [allUsers]);
    const isCheckAll = useMemo(() => allUserIds.length > 0 && shareUserIds.length === allUserIds.length, [shareUserIds, allUserIds]);
    const isIndeterminate = useMemo(() => shareUserIds.length > 0 && shareUserIds.length < allUserIds.length, [shareUserIds, allUserIds]);

    const handleCheckAllChange = (e: CheckboxChangeEvent) => {
        setShareUserIds(e.target.checked ? allUserIds : []);
    };

    const reviewerOptions = useMemo(() => {
        return allUsers.map(user => ({
            label: (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar size="small" src={user.avatar}>{`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}</Avatar>
                    <span style={{ marginLeft: 8 }}>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</span>
                </div>
            ),
            value: user.id,
        }));
    }, [allUsers]);

    const selectedReviewerObjects = useMemo(() => {
        if (!allUsers || allUsers.length === 0) return [];
        return selectedReviewerIds
            .map(id => allUsers.find(user => user.id === id))
            .filter((user): user is ReviewerUser => user !== undefined);
    }, [selectedReviewerIds, allUsers]);

    const reviewersChanged = useMemo(() => {
        const currentIds = currentReviewers.map(r => r.id).sort();
        const selectedIds = [...selectedReviewerIds].sort();
        return JSON.stringify(currentIds) !== JSON.stringify(selectedIds);
    }, [currentReviewers, selectedReviewerIds]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[400px] p-8">
                <Spin size="large" tip="Şablon yüklənir..." />
            </div>
        );
    }

    if (error && !templateData) {
        return (
            <div className="p-4 md:p-8">
                <Alert
                    message="Xəta"
                    description={error}
                    type="error"
                    showIcon
                    action={<Button type="primary" onClick={() => router.push('/dashboard/Templates/Created')}>Siyahıya Qayıt</Button>}
                />
            </div>
        );
    }

    if (!templateData) {
        return (
            <div className="p-4 md:p-8">
                <Alert
                    message="Məlumat Tapılmadı"
                    description={error || "Şablon ID-si tapılmadı və ya göstərilən ID ilə şablon mövcud deyil."}
                    type="warning"
                    showIcon
                    action={<Button type="default" onClick={() => router.push('/dashboard/Templates/Created')}>Siyahıya Qayıt</Button>}
                />
            </div>
        );
    }

    const shareModalUserOptions = allUsers.map(user => ({
        label: (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <Avatar size="small" src={user.avatar}>{`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}</Avatar>
                <span style={{ marginLeft: 8 }}>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</span>
                <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#888' }}>{`(${user.email || 'email yoxdur'})`}</span>
            </div>
        ),
        value: user.id,
    }));

    const historyColumns: ColumnsType<ShareHistoryEntry> = [
        {
            title: 'Paylaşılma Tarixi',
            dataIndex: 'sharedAt',
            key: 'sharedAt',
            render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a, b) => dayjs(a.sharedAt).unix() - dayjs(b.sharedAt).unix(),
            defaultSortOrder: 'descend',
        },
        {
            title: 'Paylaşan Şəxs',
            dataIndex: 'sharedByUser',
            key: 'sharedByUser',
            render: (user: ShareHistoryEntry['sharedByUser']) => (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar size="small" src={user.avatar}>{`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}</Avatar>
                    <span style={{ marginLeft: 8 }}>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</span>
                </div>
            ),
        },
        {
            title: 'Paylaşılan Şəxs',
            dataIndex: 'sharedWithUser',
            key: 'sharedWithUser',
            render: (user: ShareHistoryEntry['sharedWithUser']) => (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar size="small" src={user.avatar}>{`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}</Avatar>
                    <span style={{ marginLeft: 8 }}>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</span>
                </div>
            ),
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center',
            width: 100,
            render: (_, record: ShareHistoryEntry) => (
                <Tooltip title="Bu paylaşmanı ləğv et">
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteShare(record);
                        }}
                        loading={deletingShareId === record.id}
                        disabled={deletingShareId !== null && deletingShareId !== record.id}
                        style={{ border: 'none', background: 'none' }}
                    />
                </Tooltip>
            ),
        },
    ];

    return (
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
            <Card bordered={false} className="shadow-lg rounded-lg">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b pb-4">
                    <Button icon={<LeftOutlined />} onClick={() => router.push('/dashboard/Templates/Created')}> Siyahıya Qayıt </Button>
                    <Typography.Title level={4} className="mb-0 text-center flex-grow px-4 truncate" title={templateData.name || "Adsız Şablon"}> {templateData.name || "Adsız Şablon"} </Typography.Title>
                    <Button icon={<ShareAltOutlined />} onClick={handleOpenShareModal}> Paylaş </Button>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 text-sm font-serif leading-relaxed shadow-inner">
                    {/* Template-in tam məzmunu burada göstərilir */}
                    {/* <div dangerouslySetInnerHTML={{ __html: renderContentWithLabels(templateData.content) }} /> */}
                    <div className="ck-editor-wrapper">
                    <CkeditorOzel
                        onChange={() => {}}
                        initialData={templateData.content}
                        customFields={[]}
                        readOnly={true}
                    />
                    </div>
                </div>




                <Divider />
                <div className="grid grid-cols-1 gap-8 mb-8">
                    <div className="border p-4 rounded-md bg-white shadow-sm">
                        <Typography.Title level={5} className="mb-4">Reviewer Təyin Et (Maks. 5)</Typography.Title>
                        <Spin spinning={isFetchingAllUsers || isFetchingReviewers} tip="Reviewer məlumatları yüklənir...">
                            {selectedReviewerObjects.length > 0 ? (
                                <div className="mb-3 flex flex-wrap gap-2 items-center">
                                    <Typography.Text strong className="mr-2">Seçilmiş Reviewer-lər:</Typography.Text>
                                    {selectedReviewerObjects.map(user => (
                                        <Tag key={user.id} icon={<Avatar size="small" src={user.avatar}>{`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}</Avatar>} className="flex items-center">
                                            {`${user.firstName || ''} ${user.lastName || ''}`.trim()}
                                        </Tag>
                                    ))}
                                </div>
                            ) : (
                                !isFetchingAllUsers && !isFetchingReviewers && selectedReviewerIds.length === 0 && (
                                    <Typography.Text type="secondary" className="block mb-3">
                                        Dropdown-dan reviewer seçin.
                                    </Typography.Text>
                                )
                            )}
                        </Spin>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="Reviewer seçin..."
                            value={selectedReviewerIds}
                            onChange={setSelectedReviewerIds}
                            options={reviewerOptions}
                            loading={isFetchingAllUsers}
                            maxCount={5}
                            filterOption={(input, option) =>
                                (option?.label as React.ReactElement)?.props?.children[1]?.props?.children
                                    ?.toLowerCase().includes(input.toLowerCase()) ?? false
                            }
                            className="mb-4"
                        />
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={isSavingReviewers}
                            onClick={handleSaveReviewers}
                            disabled={!reviewersChanged || isSavingReviewers}
                        >
                            Reviewer-ləri Yadda Saxla
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        type="primary"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleDelete}
                        disabled={isDeleting}
                        loading={isDeleting}
                    >
                        Şablonu Sil
                    </Button>
                </div>

                <Modal
                    title="Şablonu İstifadəçilərlə Paylaş"
                    open={isShareModalVisible}
                    onOk={handleShareTemplate}
                    onCancel={handleCloseShareModal}
                    confirmLoading={isSharing}
                    okText="Paylaş"
                    cancelText="Ləğv et"
                    destroyOnClose
                    width={600}
                >
                    <Spin spinning={isFetchingAllUsers} tip="İstifadəçilər yüklənir...">
                        {allUsers.length === 0 && !isFetchingAllUsers ? (
                            <Empty description="Paylaşmaq üçün istifadəçi tapılmadı." image={Empty.PRESENTED_IMAGE_SIMPLE}/>
                        ) : (
                            <>
                                <Checkbox
                                    indeterminate={isIndeterminate}
                                    onChange={handleCheckAllChange}
                                    checked={isCheckAll}
                                    disabled={allUsers.length === 0}
                                    style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'}}
                                >
                                    Hamısını seç ({shareUserIds.length}/{allUsers.length})
                                </Checkbox>
                                <Checkbox.Group
                                    style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}
                                    options={shareModalUserOptions}
                                    value={shareUserIds}
                                    onChange={(checkedValues) => setShareUserIds(checkedValues as string[])}
                                />
                            </>
                        )}
                    </Spin>
                </Modal>

                <Divider />
                <div className="mt-8">
                    <Typography.Title level={5} className="mb-4">Paylaşma Tarixçəsi</Typography.Title>
                    <Table
                        columns={historyColumns}
                        dataSource={shareHistory}
                        loading={isFetchingHistory}
                        rowKey="id"
                        pagination={{ pageSize: 5 }}
                        locale={{ emptyText: 'Paylaşma tarixçəsi tapılmadı.' }}
                        size="small"
                    />
                </div>
            </Card>
        </div>
    );
}

export default function ViewTemplatePage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen p-8"><Spin size="large" tip="Səhifə yüklənir..." /></div>}>
            <ViewTemplateContent />
        </Suspense>
    );
}
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Button, Typography, Row, Col, message, Tag, Modal, Input, Select, List, Avatar, Space, Tooltip, Image as AntImage, Card } from 'antd';
import {
    ArrowLeftOutlined, CheckOutlined, CloseOutlined, SendOutlined, HistoryOutlined,
    SyncOutlined, QrcodeOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { getCurrentUser } from '@/utils/api';
import axios from 'axios';
import CkeditorOzel from '../../../CreateLetter/ckeditor_letter';
import { v4 as uuidv4 } from 'uuid';

async function apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const config: RequestInit = { method, headers, credentials: 'include' };
    if (body) { config.body = JSON.stringify(body); }
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}${endpoint}`, config);
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! Status: ${response.status}` };
        try { errorData = await response.json(); } catch (e) { }
        throw new Error(errorData?.message || `HTTP error! Status: ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; } catch (e) { return undefined as T; }
}

interface Reference { id: string; name: string; type: string; }
interface DynamicDbData { companies: Array<{ id: string; name: string }>; vendors: Array<{ id: string; name: string }>; contracts: Array<{ id: string; name: string }>; customs: Array<{ id: string; name: string }>; documentTypes: Array<{ id: string; name: string }>; subContractorNames: Array<{ id: string; name: string }>; }
interface SavedTemplate {
    id: string;
    name?: string | null;
    content: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}
interface FormData {
    [key: string]: string;
}
enum LetterWorkflowStatus { DRAFT = 'draft', PENDING_REVIEW = 'pending_review', PENDING_APPROVAL = 'pending_approval', APPROVED = 'approved', REJECTED = 'rejected' }
enum LetterReviewerStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected', SKIPPED = 'skipped', REASSIGNED = 'reassigned' }
enum LetterActionType { SUBMIT = 'submit', APPROVE_REVIEW = 'approve_review', REJECT_REVIEW = 'reject_review', REASSIGN_REVIEW = 'reassign_review', FINAL_APPROVE = 'final_approve', FINAL_REJECT = 'final_reject', RESUBMIT = 'resubmit', COMMENT = 'comment', UPLOAD_REVISION = 'upload_revision' }
interface UserInfo { id: string; firstName?: string | null; lastName?: string | null; email: string; avatar?: string | null; }
interface ActionLog { id: string; userId: string; actionType: string; comment?: string | null; details?: any; createdAt: string; user?: UserInfo | null; }
interface ReviewerStep { id: string; userId: string; sequenceOrder: number; status: string; actedAt?: string | null; reassignedFromUserId?: string | null; user?: UserInfo | null; }
interface LetterDetails {
    id: string;
    name?: string | null;
    userId: string;
    workflowStatus: string;
    nextActionById?: string | null;
    createdAt: string;
    updatedAt: string;
    user?: UserInfo | null;
    letterReviewers?: ReviewerStep[] | null;
    letterActionLogs?: ActionLog[] | null;
    template: SavedTemplate | null;
    formData: Partial<FormData>;
    finalSignatureUrl?: string | null;
    finalStampUrl?: string | null;
}
interface CurrentUserType { id: string; email: string; firstName?: string | null; lastName?: string | null; avatar?: string | null; }
interface SignatureData { id: string; r2Url: string; name?: string; createdAt: string; }
interface StampData { id: string; r2Url: string; name?: string; createdAt: string; }

// New interfaces for placing items
interface PlacedItemHtml {
    id: string;
    type: 'signature' | 'stamp' | 'qrcode';
    url?: string;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
}

interface PlacingItemInfo {
    type: 'signature' | 'stamp' | 'qrcode';
    url?: string;
    width: number;
    height: number;
}

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const QR_PLACEHOLDER_COLOR = 'rgba(0, 150, 50, 0.7)';

function LetterPreviewPanelReview({
    template,
    formData,
    dbData,
    signatureUrl,
    stampUrl,
    onLetterClick,
    placedItems,
    onRemoveItem,
}: {
    template: SavedTemplate | null;
    formData: FormData;
    dbData: DynamicDbData;
    signatureUrl?: string | null;
    stampUrl?: string | null;
    onLetterClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    placedItems: PlacedItemHtml[];
    onRemoveItem?: (id: string) => void;
}) {
    const [processedContent, setProcessedContent] = useState<string>('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (template?.content) {
            const renderedContent = renderContentWithPlaceholders(template.content);
            setProcessedContent(renderedContent);
        }
    }, [template, formData]);

    const renderContentWithPlaceholders = (text: string): string => {
        if (!text) return '';
        return text.replace(/#([a-zA-Z0-9-]+)#/g, (match, p1) => {
            return formData[p1] || `[${p1} boşdur]`;
        });
    };

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (onLetterClick) onLetterClick(event);
    };

    if (!template) {
        return <div className="flex items-center justify-center h-full text-gray-500">Template data is missing. Cannot render preview.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="relative bg-white rounded-lg shadow border border-gray-200 min-h-[800px] text-sm font-serif leading-relaxed">
                <div ref={wrapperRef} className="ck-editor-wrapper" onClick={handleClick}>
                    <CkeditorOzel
                        onChange={() => {}}
                        initialData={processedContent}
                        customFields={[]}
                        readOnly={true}
                    />
                    {placedItems.map(item => {
                        const style: React.CSSProperties = {
                            position: 'absolute',
                            left: `${item.xPct * 100}%`,
                            top: `${item.yPct * 100}%`,
                            width: `${item.widthPct * 100}%`,
                            height: `${item.heightPct * 100}%`,
                            cursor: 'pointer',
                        };
                        if (item.type === 'qrcode') {
                            return (
                                <div
                                    key={item.id}
                                    style={style}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onRemoveItem) onRemoveItem(item.id);
                                    }}
                                >
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: QR_PLACEHOLDER_COLOR,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        border: '2px dashed white',
                                    }}>
                                        QR
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <img
                                    key={item.id}
                                    src={item.url}
                                    alt={item.type}
                                    style={style}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onRemoveItem) onRemoveItem(item.id);
                                    }}
                                />
                            );
                        }
                    })}
                </div>
                {!placedItems.length && (
                    <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end h-24">
                        {signatureUrl && (
                            <div className="flex flex-col items-center">
                                <AntImage src={signatureUrl} alt="Signature" width={100} height={40} preview={false} className="object-contain" />
                                <Text className="text-xs mt-1">Signature</Text>
                            </div>
                        )}
                        {stampUrl && (
                            <div className="flex flex-col items-center">
                                <AntImage src={stampUrl} alt="Stamp" width={60} height={60} preview={false} className="object-contain" />
                                <Text className="text-xs mt-1">Stamp</Text>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style jsx>{`
                .ck-editor-wrapper {
                    padding: 2rem 3rem;
                    max-height: 1200px;
                    overflow-y: auto;
                    position: relative;
                }
                .ck-editor-wrapper :global(.ck-content) {
                    min-height: 600px;
                    background-color: #fff;
                    border: none;
                    padding: 0;
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #333;
                }
                .ck-editor-wrapper :global(.ck-content p) {
                    margin-bottom: 1em;
                }
                .ck-editor-wrapper :global(.ck-content img) {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 10px 0;
                }
                .ck-editor-wrapper :global(.ck-content ul),
                .ck-editor-wrapper :global(.ck-content ol) {
                    margin: 1em 0;
                    padding-left: 40px;
                }
                .ck-editor-wrapper :global(.ck-content li) {
                    margin-bottom: 0.5em;
                }
            `}</style>
        </div>
    );
}

export default function LetterHtmlReviewPage() {
    const router = useRouter();
    const params = useParams();
    const letterId = params?.letterId as string | undefined;

    const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
    const [letterDetails, setLetterDetails] = useState<LetterDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isReassignModalVisible, setIsReassignModalVisible] = useState(false);
    const [reassignTargetUserId, setReassignTargetUserId] = useState<string | null>(null);
    const [reassignOptions, setReassignOptions] = useState<UserInfo[]>([]);
    const [actionComment, setActionComment] = useState('');
    const [resubmitComment, setResubmitComment] = useState('');
    const [allReferences, setAllReferences] = useState<Reference[]>([]);
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([]);
    const [savedStamps, setSavedStamps] = useState<StampData[]>([]);
    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null);
    const [selectedStampUrl, setSelectedStampUrl] = useState<string | null>(null);
    const [placedItems, setPlacedItems] = useState<PlacedItemHtml[]>([]);
    const [placingItem, setPlacingItem] = useState<PlacingItemInfo | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState<string>('');

    useEffect(() => {
        const fetchUser = async () => {
            setIsUserLoading(true);
            try {
                const user = await getCurrentUser();
                setCurrentUser(user);
            } catch (err) {
                console.error("Failed to fetch current user:", err);
                setError("Failed to get user information. Actions may be disabled.");
                setCurrentUser(null);
            } finally {
                setIsUserLoading(false);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (!letterId) {
            setError("Letter ID is missing from the URL.");
            setIsLoading(false);
            return;
        }
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const details = await apiRequest<LetterDetails>(`/letters/${letterId}`);
                setLetterDetails(details);
                const refs = await apiRequest<Reference[]>('/references');
                setAllReferences(refs || []);
            } catch (err: any) {
                console.error("Error fetching letter details or references:", err);
                setError(err.message || "An error occurred while loading the letter.");
                setLetterDetails(null);
                setAllReferences([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [letterId]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const sigsRaw = localStorage.getItem('signatures_r2');
                const parsedSigs = sigsRaw ? JSON.parse(sigsRaw) : [];
                if (Array.isArray(parsedSigs)) {
                    setSavedSignatures(parsedSigs.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt })));
                } else { setSavedSignatures([]); }
            } catch (e) { console.error("Failed to load/parse signatures", e); setSavedSignatures([]); }
            try {
                const stmpsRaw = localStorage.getItem('stamps_r2');
                const parsedStamps = stmpsRaw ? JSON.parse(stmpsRaw) : [];
                if (Array.isArray(parsedStamps)) {
                    setSavedStamps(parsedStamps.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt })));
                } else { setSavedStamps([]); }
            } catch (e) { console.error("Failed to load/parse stamps", e); setSavedStamps([]); }
        }
    }, []);

    useEffect(() => {
        if (isReassignModalVisible && letterDetails) {
            const fetchUsers = async () => {
                try {
                    const allUsers = await apiRequest<UserInfo[]>('/users');
                    const currentWorkflowUserIds = new Set(letterDetails.letterReviewers?.map(r => r.userId) ?? []);
                    currentWorkflowUserIds.add(letterDetails.userId);
                    if (currentUser) {
                        currentWorkflowUserIds.add(currentUser.id);
                    }
                    const availableUsers = allUsers.filter(user => !currentWorkflowUserIds.has(user.id));
                    setReassignOptions(availableUsers);
                } catch (err: any) {
                    message.error("Failed to load users for reassignment.");
                    setReassignOptions([]);
                }
            };
            fetchUsers();
        }
    }, [isReassignModalVisible, letterDetails, currentUser]);

    const dbData = useMemo<DynamicDbData>(() => {
        const data: DynamicDbData = { companies: [], vendors: [], contracts: [], customs: [], documentTypes: [], subContractorNames: [] };
        allReferences.forEach(ref => {
            const item = { id: ref.id, name: ref.name };
            switch (ref.type) {
                case 'Company': data.companies.push(item); break;
                case 'Vendor Name': data.vendors.push(item); break;
                case 'Contract Number': data.contracts.push(item); break;
                case 'Customs Department': data.customs.push(item); break;
                case 'Document Type': data.documentTypes.push(item); break;
                case 'Sub-Contractor Name': data.subContractorNames.push(item); break;
            }
        });
        return data;
    }, [allReferences]);

    const fullFormDataForPreview = useMemo<FormData | null>(() => {
        if (!letterDetails || !letterDetails.formData) return null;
        return {
            ...letterDetails.formData,
        } as FormData;
    }, [letterDetails]);

    const isCurrentUserNextActor = useMemo(() => {
        return !!currentUser && !!letterDetails && letterDetails.nextActionById === currentUser.id;
    }, [currentUser, letterDetails]);

    const canTakeAction = useMemo(() => {
        const status = letterDetails?.workflowStatus;
        const isCorrectStatus = status === LetterWorkflowStatus.PENDING_REVIEW || status === LetterWorkflowStatus.PENDING_APPROVAL;
        return !!letterDetails && isCurrentUserNextActor && isCorrectStatus;
    }, [isCurrentUserNextActor, letterDetails]);

    const isSubmitterOfRejectedLetter = useMemo(() => {
        return !!currentUser && !!letterDetails &&
            letterDetails.workflowStatus === LetterWorkflowStatus.REJECTED &&
            letterDetails.userId === currentUser.id;
    }, [currentUser, letterDetails]);

    const isFinalApprovalSigningMode = canTakeAction && letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;

    const handleLetterAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!placingItem || !isFinalApprovalSigningMode) return;
        const wrapper = event.currentTarget;
        const rect = wrapper.getBoundingClientRect();
        const scrollTop = wrapper.scrollTop;
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top + scrollTop;
        const containerWidth = wrapper.clientWidth;
        const containerHeight = wrapper.scrollHeight;
        const xPct = clickX / containerWidth;
        const yPct = clickY / containerHeight;

        let widthPx, heightPx;
        if (placingItem.type === 'signature') {
            widthPx = 100;
            heightPx = 40;
        } else if (placingItem.type === 'stamp') {
            widthPx = 60;
            heightPx = 60;
        } else { // qrcode
            widthPx = 50;
            heightPx = 50;
        }
        const widthPct = widthPx / containerWidth;
        const heightPct = heightPx / containerHeight;

        const newItem: PlacedItemHtml = {
            id: uuidv4(),
            type: placingItem.type,
            url: placingItem.type !== 'qrcode' ? placingItem.url : undefined,
            xPct,
            yPct,
            widthPct,
            heightPct,
        };
        setPlacedItems(prev => [...prev, newItem]);
        setPlacingItem(null);
    };

    const handleRemoveItem = (id: string) => {
        setPlacedItems(prev => prev.filter(item => item.id !== id));
    };

    const handlePlaceSignature = (sig: SignatureData) => {
        setPlacingItem({ type: 'signature', url: sig.r2Url, width: 100, height: 40 });
        setSelectedSignatureUrl(sig.r2Url);
        setSelectedStampUrl(null);
        message.info('Click on the PDF page to place the signature.');
    };

    const handlePlaceStamp = (sig: StampData) => {

        setPlacingItem({ type: 'stamp', url: sig.r2Url, width: 65, height: 60 });
        setSelectedStampUrl(sig.r2Url);
        setSelectedSignatureUrl(null);
        message.info('Click on the PDF page to place the stamp.');
    };

    const handlePlaceQrCode = () => {
        setPlacingItem({ type: 'qrcode', width: 50, height: 50 });
        message.info('Click on the PDF page to place the QR Code. This is a required step for final approval.');
    };

    const handleApprove = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction) return;
        const isFinalApproval = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
        
        if (isFinalApproval) {
            const hasQrCode = placedItems.some(item => item.type === 'qrcode');
            
            if (!hasQrCode) {
                message.error("QR Code placement is mandatory for final approval. Please place a QR Code on the document.");
                return;
            }
            
            if (placedItems.length === 0) {
                message.error("Please place at least one item (signature, stamp, or QR code) for final approval.");
                return;
            }
        }
        
        setIsActionLoading(true);
        message.loading({ content: 'Processing approval...', key: 'action', duration: 0 });
        try {
            const endpoint = isFinalApproval ? `/letters/${letterId}/final-approve-letter` : `/letters/${letterId}/approve-review`;
            const payload = isFinalApproval
                ? {
                    comment: actionComment,
                    name: editedName.trim(),
                    placements: placedItems.map(item => ({
                        type: item.type,
                        url: item.type === 'qrcode' ? 'QR_PLACEHOLDER' : item.url,
                        xPct: item.xPct,
                        yPct: item.yPct,
                        widthPct: item.widthPct,
                        heightPct: item.heightPct,
                    })),
                  }
                : { 
                    comment: actionComment,
                    name: editedName.trim()
                };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Action successful!', key: 'action', duration: 2 });
            setActionComment('');
            if (isFinalApproval) {
                setSelectedSignatureUrl(null);
                setSelectedStampUrl(null);
                setPlacedItems([]);
            }
            router.push('/dashboard/Inbox');
        } catch (apiError: any) {
            message.error({ content: `Failed to process approval: ${apiError.message || 'Unknown error'}`, key: 'action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction) return;
        if (!actionComment.trim()) {
            message.error("Rejection reason/comment cannot be empty.");
            return;
        }
        setIsActionLoading(true);
        message.loading({ content: 'Processing rejection...', key: 'action', duration: 0 });
        try {
            const isFinalApproval = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            const endpoint = isFinalApproval ? `/letters/${letterId}/final-reject` : `/letters/${letterId}/reject-review`;
            const payload = { reason: actionComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Rejection successful!', key: 'action', duration: 2 });
            setActionComment('');
            router.push('/dashboard/Inbox');
        } catch (apiError: any) {
            message.error({ content: `Failed to process rejection: ${apiError.message || 'Unknown error'}`, key: 'action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const showReassignModal = () => setIsReassignModalVisible(true);
    const handleReassignCancel = () => setIsReassignModalVisible(false);
    const handleReassignSubmit = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction || !reassignTargetUserId) {
            message.error("Please select a user to reassign to.");
            return;
        }
        setIsActionLoading(true);
        setIsReassignModalVisible(false);
        message.loading({ content: 'Processing reassignment...', key: 'action', duration: 0 });
        try {
            const endpoint = `/letters/${letterId}/reassign`;
            const payload = { newUserId: reassignTargetUserId, reason: actionComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Reassignment successful!', key: 'action', duration: 2 });
            setReassignTargetUserId(null);
            setActionComment('');
            router.push('/dashboard/Inbox');
        } catch (apiError: any) {
            message.error({ content: `Failed to process reassignment: ${apiError.message || 'Unknown error'}`, key: 'action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleResubmit = async () => {
        if (!letterId || !currentUser?.id || !isSubmitterOfRejectedLetter) return;
        if (!resubmitComment.trim()) {
            message.error("Resubmission comment cannot be empty.");
            return;
        }
        setIsActionLoading(true);
        message.loading({ content: 'Resubmitting letter...', key: 'resubmit-action', duration: 0 });
        try {
            const endpoint = `/letters/${letterId}/resubmit`;
            const payload: { comment: string } = { comment: resubmitComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Letter resubmitted successfully!', key: 'resubmit-action', duration: 2 });
            setResubmitComment('');
            router.push('/dashboard/MyStaff');
        } catch (apiError: any) {
            message.error({ content: `Failed to resubmit letter: ${apiError.message || 'Unknown error'}`, key: 'resubmit-action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const renderActionButtons = () => {
        if (isUserLoading) return <Spin size="small" />;

        if (canTakeAction) {
            const isFinalApprovalStep = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            return (
                <Space wrap>
                    <Button danger icon={<CloseOutlined />} onClick={handleReject} loading={isActionLoading} disabled={isActionLoading || !actionComment.trim()}> Reject </Button>
                    {!isFinalApprovalStep && (
                        <Button icon={<SendOutlined />} onClick={showReassignModal} loading={isActionLoading} disabled={isActionLoading}> Reassign </Button>
                    )}
                    <Button 
                        type="primary" 
                        icon={<CheckOutlined />} 
                        onClick={handleApprove} 
                        loading={isActionLoading} 
                        disabled={
                            isActionLoading || 
                            (isFinalApprovalStep && (
                                placedItems.length === 0 || 
                                !placedItems.some(item => item.type === 'qrcode')
                            ))
                        }
                        title={isFinalApprovalStep && !placedItems.some(item => item.type === 'qrcode') ? 'QR Code placement is required for final approval' : ''}
                    >
                        {isFinalApprovalStep ? 'Final Approve' : 'Approve Step'}
                    </Button>
                </Space>
            );
        } else if (isSubmitterOfRejectedLetter) {
            return (
                <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={handleResubmit}
                    loading={isActionLoading}
                    disabled={isActionLoading || !resubmitComment.trim()}
                >
                    Resubmit Letter
                </Button>
            );
        }
        return null;
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case LetterWorkflowStatus.PENDING_REVIEW: case LetterWorkflowStatus.PENDING_APPROVAL: return 'processing';
            case LetterWorkflowStatus.APPROVED: return 'success';
            case LetterWorkflowStatus.REJECTED: return 'error';
            case LetterWorkflowStatus.DRAFT: return 'default';
            default: return 'default';
        }
    };

    const getReviewerStatusColor = (status: string): string => {
        switch (status) {
            case LetterReviewerStatus.PENDING: return 'default';
            case LetterReviewerStatus.APPROVED: return 'success';
            case LetterReviewerStatus.REJECTED: return 'error';
            case LetterReviewerStatus.REASSIGNED: return 'warning';
            case LetterReviewerStatus.SKIPPED: return 'default';
            default: return 'default';
        }
    };

    const formatStatus = (status: string): string => status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
    const formatActionType = (action: string): string => action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Action';
    const getUserFullName = (user?: UserInfo | null): string => { if (!user) return 'System/Unknown'; return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unnamed User'; };
    const getInitials = (user?: UserInfo | null): string => { if (!user) return 'S'; const first = user.firstName?.[0] || ''; const last = user.lastName?.[0] || ''; return (first + last).toUpperCase() || user.email?.[0].toUpperCase() || '?'; };
    const submitterName = useMemo(() => getUserFullName(letterDetails?.user), [letterDetails]);

    const renderContent = () => {
        if (isLoading || isUserLoading) {
            return <div className="text-center p-20"><Spin size="large" tip="Loading Letter Details..." /></div>;
        }
        if (error) {
            return <Alert message="Error Loading Letter" description={error} type="error" showIcon closable onClose={() => setError(null)} />;
        }
        if (!letterDetails || !fullFormDataForPreview || !letterDetails.template) {
            return <Alert message="Incomplete Data" description="Could not load all necessary letter details, template, or form data." type="warning" showIcon />;
        }

        const showResubmitSection = isSubmitterOfRejectedLetter;
        const showActionCommentArea = canTakeAction;

        return (
            <>
                {showResubmitSection && (
                    <Card className="mb-4" title="Resubmit Letter">
                        <Paragraph type="warning">This letter was rejected. Review comments below, add a required comment, and resubmit.</Paragraph>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <TextArea rows={4} placeholder="Comment explaining changes (required)..." value={resubmitComment} onChange={(e) => setResubmitComment(e.target.value)} disabled={isActionLoading} />
                        </Space>
                    </Card>
                )}

                <Row gutter={[16, 16]} className="letter-review-row">
                    <Col xs={24} lg={16} className="letter-preview-col">
                        <LetterPreviewPanelReview
                            template={letterDetails.template}
                            formData={fullFormDataForPreview}
                            dbData={dbData}
                            signatureUrl={isFinalApprovalSigningMode ? null : (letterDetails.workflowStatus === LetterWorkflowStatus.APPROVED ? letterDetails.finalSignatureUrl : null)}
                            stampUrl={isFinalApprovalSigningMode ? null : (letterDetails.workflowStatus === LetterWorkflowStatus.APPROVED ? letterDetails.finalStampUrl : null)}
                            onLetterClick={handleLetterAreaClick}
                            placedItems={isFinalApprovalSigningMode ? placedItems : []}
                            onRemoveItem={handleRemoveItem}
                        />
                    </Col>

                    <Col xs={24} lg={8} className="workflow-col">
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 space-y-4 workflow-container"  style={{ display: 'flex', flexDirection: 'column', maxHeight: 'auto', overflowY: 'auto' }}>
                            {isFinalApprovalSigningMode && (
                                <div className="border-b pb-4 mb-4 space-y-3">
                                    <Alert 
                                        message="Final Approval Stage" 
                                        description="You are the final approver. Please place your signature/stamp and the required QR code on the document before approving."
                                        type="info" 
                                        showIcon 
                                        style={{ marginBottom: '12px' }}
                                    />
                                    <Title level={5} style={{ marginBottom: '8px' }}>Add Signature, Stamp & QR Code</Title>
                                    <div>
                                        <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Signature</Typography.Title>
                                        {savedSignatures.length === 0 ? (
                                            <Typography.Text type="secondary">No signatures available.</Typography.Text>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {savedSignatures.map(sig => (
                                                    <button
                                                        key={sig.id}
                                                        type="button"
                                                        onClick={() => handlePlaceSignature(sig)}
                                                        className={`p-1 border rounded-md transition-all ${selectedSignatureUrl === sig.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                                        title={sig.name || 'Signature'}
                                                    >
                                                        <AntImage src={sig.r2Url} alt={sig.name || 'Signature'} width={80} height={35} preview={false} className="object-contain" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {/* {savedSignatures.length > 0 && (
                                            <Button onClick={handlePlaceSignature} disabled={!selectedSignatureUrl} className="mt-2">Place Signature</Button>
                                        )} */}
                                    </div>
                                    <div>
                                        <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Stamp</Typography.Title>
                                        {savedStamps.length === 0 ? (
                                            <Typography.Text type="secondary">No stamps available.</Typography.Text>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {savedStamps.map(stamp => (
                                                    <button
                                                        key={stamp.id}
                                                        type="button"
                                                        onClick={() => handlePlaceStamp(stamp)}
                                                        className={`p-1 border rounded-full transition-all ${selectedStampUrl === stamp.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                                        title={stamp.name || 'Stamp'}
                                                    >
                                                        <AntImage src={stamp.r2Url} alt={stamp.name || 'Stamp'} width={45} height={45} preview={false} className="object-contain rounded-full" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {/* {savedStamps.length > 0 && (
                                            <Button onClick={handlePlaceStamp} disabled={!selectedStampUrl} className="mt-2">Place Stamp</Button>
                                        )} */}
                                    </div>
                                    <div>
                                        <Typography.Title level={5} style={{ marginBottom: '8px' }}>
                                            Add QR Code <span style={{ color: 'red' }}>*</span>
                                            <Tooltip title="QR Code placement is required for final approval">
                                                <InfoCircleOutlined style={{ marginLeft: '5px', fontSize: '14px' }} />
                                            </Tooltip>
                                        </Typography.Title>
                                        <Button 
                                            type="primary" 
                                            icon={<QrcodeOutlined />} 
                                            onClick={handlePlaceQrCode}
                                            danger={isFinalApprovalSigningMode && !placedItems.some(item => item.type === 'qrcode')}
                                        >
                                            {placedItems.some(item => item.type === 'qrcode') ? 'QR Code Added' : 'Place QR Code (Required)'}
                                        </Button>
                                    </div>
                                    {placingItem && (
                                        <Alert message={`Click on the letter to place the ${placingItem.type}.`} type="info" showIcon closable onClose={() => setPlacingItem(null)} className="mt-2" />
                                    )}
                                    {isFinalApprovalSigningMode && !placedItems.some(item => item.type === 'qrcode') && !placingItem && (
                                        <Alert message="QR code placement is required for final approval" type="warning" showIcon className="mt-2" />
                                    )}
                                </div>
                            )}

                            <div>
                                <Title level={5}>Workflow Status</Title>
                                <Tag color={getStatusColor(letterDetails.workflowStatus)}>{formatStatus(letterDetails.workflowStatus)}</Tag>
                                {letterDetails.workflowStatus !== LetterWorkflowStatus.APPROVED && letterDetails.workflowStatus !== LetterWorkflowStatus.REJECTED && letterDetails.nextActionById && (
                                    <Text type="secondary" className="block mt-1"> Waiting for: {getUserFullName(letterDetails.letterReviewers?.find(r => r.userId === letterDetails.nextActionById)?.user)} </Text>
                                )}
                            </div>
                            <div className="flex-grow overflow-hidden flex flex-col">
                                <Title level={5}><HistoryOutlined /> Action History & Comments</Title>
                                <div className="flex-grow overflow-y-auto pr-2 mb-2">
                                    <List itemLayout="horizontal" dataSource={letterDetails.letterActionLogs ?? []} locale={{ emptyText: "No actions logged yet." }}
                                        renderItem={item => (
                                            <List.Item>
                                                <List.Item.Meta
                                                    avatar={<Avatar src={item.user?.avatar} >{getInitials(item.user)}</Avatar>}
                                                    title={<><Text strong>{formatActionType(item.actionType)}</Text> by <Text>{getUserFullName(item.user)}</Text></>}
                                                    description={
                                                        <>
                                                            <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
                                                            {item.comment && (
                                                                <Paragraph
                                                                    ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
                                                                    className={`mt-1 mb-0 p-1 rounded border ${
                                                                        item.actionType === LetterActionType.REJECT_REVIEW || item.actionType === LetterActionType.FINAL_REJECT
                                                                            ? 'bg-red-50 border-red-100'
                                                                            : 'bg-gray-50 border-gray-100'
                                                                        }`}
                                                                >
                                                                    {item.comment}
                                                                </Paragraph>
                                                            )}
                                                        </>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            </div>
                            {showActionCommentArea && (
                                <div className='mt-auto pt-2 border-t'>
                                    <Title level={5} style={{ marginBottom: '8px' }}>Action Comment / Reason</Title>
                                    <TextArea
                                        rows={3}
                                        placeholder="Enter reason for rejection, note for reassignment, or comment for approval..."
                                        value={actionComment}
                                        onChange={(e) => setActionComment(e.target.value)}
                                        disabled={isActionLoading}
                                    />
                                    {canTakeAction && <Text type="secondary" className='text-xs block mt-1'>This comment/reason will be saved when you click Reject or Reassign.</Text>}
                                </div>
                            )}

                            <div>
                                <Title level={5} style={{ marginTop: '16px' }}>Reviewers & Approver</Title>
                                <List size="small" dataSource={letterDetails.letterReviewers?.sort((a, b) => a.sequenceOrder - b.sequenceOrder) ?? []} locale={{ emptyText: "No reviewers or approver assigned." }}
                                    renderItem={item => (
                                        <List.Item>
                                            <List.Item.Meta avatar={<Avatar src={item.user?.avatar} >{getInitials(item.user)}</Avatar>} title={<>{item.sequenceOrder === 999 ? 'Approver: ' : `Reviewer ${item.sequenceOrder}: `} {getUserFullName(item.user)}</>} description={<Tag color={getReviewerStatusColor(item.status)}>{formatStatus(item.status)}</Tag>} />
                                        </List.Item>
                                    )}
                                />
                            </div>
                        </div>
                    </Col>
                </Row>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-lg shadow-sm flex-wrap">
                <div className="flex items-center mr-4 mb-2 md:mb-0">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} type="text" aria-label="Go back" className="mr-2" />
                    <div className="flex items-center">
                        <Title level={3} className="mb-0 mr-2">Review Letter:</Title>
                        <Input
                            value={(editedName || letterDetails?.name) ?? ''}
                            onChange={(e) => setEditedName(e.target.value)}
                            size="large"
                            style={{ width: '300px' }}
                            placeholder="Enter letter name"
                        />
                    </div>
                </div>
                <div className="flex justify-end flex-grow">
                    {renderActionButtons()}
                </div>
            </div>
            {!isLoading && letterDetails && (
                <div className="mb-4 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                    Submitted by: <span className="font-semibold">{submitterName}</span> on <span className="font-semibold">{new Date(letterDetails.createdAt).toLocaleDateString('en-CA')}</span>
                    <span className="ml-4 pl-4 border-l border-gray-300">Current Status: <Tag color={getStatusColor(letterDetails.workflowStatus)}>{formatStatus(letterDetails.workflowStatus)}</Tag></span>
                </div>
            )}
            {error && <Alert message="PDF Load Error" description={error} type="error" showIcon closable onClose={() => setError(null)} className="mb-4" />}

            {renderContent()}

            <Modal title="Reassign Review Step" open={isReassignModalVisible} onOk={handleReassignSubmit} onCancel={handleReassignCancel} confirmLoading={isActionLoading} okText="Reassign" cancelText="Cancel" okButtonProps={{ disabled: !reassignTargetUserId || !actionComment.trim() }}>
                <Paragraph>Select the user to reassign this review step to. They will be notified. The reason/note should be entered in the main text area below the history.</Paragraph>
                <Select showSearch placeholder="Select a user to reassign to" style={{ width: '100%', marginBottom: '10px' }} value={reassignTargetUserId} onChange={(value) => setReassignTargetUserId(value)} filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())} loading={reassignOptions.length === 0} >
                    {reassignOptions.map(user => ( <Option key={user.id} value={user.id} label={getUserFullName(user)}> <Space> <Avatar src={user.avatar} size="small">{getInitials(user)}</Avatar> {getUserFullName(user)} ({user.email}) </Space> </Option> ))}
                </Select>
                <Alert message="Note:" description="The comment for this reassignment will be taken from the 'Action Comment / Reason' text area on the main page." type="info" showIcon />
            </Modal>
        </div>
    );
}

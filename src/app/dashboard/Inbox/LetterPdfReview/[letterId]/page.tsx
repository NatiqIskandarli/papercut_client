'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Button, Typography, Row, Col, message, Tag, Modal, Input, Select, List, Avatar, Space, Tooltip, Upload, Card, Image as AntImage } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import {
    ArrowLeftOutlined, CheckOutlined, CloseOutlined, SendOutlined, HistoryOutlined,
    ZoomInOutlined, ZoomOutOutlined, UndoOutlined, InboxOutlined, SyncOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { getCurrentUser } from '@/utils/api'; 
import { PDFDocument, PDFImage } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

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

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

enum LetterWorkflowStatus { DRAFT = 'draft', PENDING_REVIEW = 'pending_review', PENDING_APPROVAL = 'pending_approval', APPROVED = 'approved', REJECTED = 'rejected' }
enum LetterReviewerStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected', SKIPPED = 'skipped', REASSIGNED = 'reassigned' }
enum LetterActionType { SUBMIT = 'submit', APPROVE_REVIEW = 'approve_review', REJECT_REVIEW = 'reject_review', REASSIGN_REVIEW = 'reassign_review', FINAL_APPROVE = 'final_approve', FINAL_REJECT = 'final_reject', RESUBMIT = 'resubmit', COMMENT = 'comment', UPLOAD_REVISION = 'upload_revision' }

interface UserInfo { id: string; firstName?: string | null; lastName?: string | null; email: string; avatar?: string | null; }
interface ActionLog { id: string; userId: string; actionType: string; comment?: string | null; details?: any; createdAt: string; user?: UserInfo | null; }
interface ReviewerStep { id: string; userId: string; sequenceOrder: number; status: string; actedAt?: string | null; reassignedFromUserId?: string | null; user?: UserInfo | null; }
interface LetterDetails { id: string; name?: string | null; userId: string; workflowStatus: string; nextActionById?: string | null; signedPdfUrl?: string | null; originalPdfFileId?: string | null; createdAt: string; updatedAt: string; user?: UserInfo | null; letterReviewers?: ReviewerStep[] | null; letterActionLogs?: ActionLog[] | null; }
interface CurrentUserType { id: string; email: string; firstName?: string | null; lastName?: string | null; avatar?: string | null; }
interface UploadResponseFile { id: string; name: string; path: string; url?: string; }
interface SignatureData { id: string; r2Url: string; name?: string; createdAt: string; }
interface StampData { id: string; r2Url: string; name?: string; createdAt: string; }

interface PlacementInfoForDisplay {
    id?: string;
    type: 'signature' | 'stamp' | 'qrcode';
    url?: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
}



interface LetterDetails {
    id: string;
    name?: string | null;
    userId: string;
    workflowStatus: string;
    nextActionById?: string | null;
    signedPdfUrl?: string | null;
    finalSignedPdfUrl?: string | null;
    originalPdfFileId?: string | null;
    createdAt: string;
    updatedAt: string;
    user?: UserInfo | null;
    letterReviewers?: ReviewerStep[] | null;
    letterActionLogs?: ActionLog[] | null;
    placements?: PlacementInfoForDisplay[] | null;
}

interface CurrentUserType { id: string; email: string; firstName?: string | null; lastName?: string | null; avatar?: string | null; }
interface UploadResponseFile { id: string; name: string; path: string; url?: string; }
interface SignatureData { id: string; r2Url: string; name?: string; createdAt: string; }
interface StampData { id: string; r2Url: string; name?: string; createdAt: string; }

interface PlacedItem {
    id: string;
    type: 'signature' | 'stamp' | 'qrcode';
    url?: string; // URL is optional for QR codes
    pageNumber: number;
    xPct: number; // Position X as percentage of original page width
    yPct: number; // Position Y as percentage of original page height
    widthPct: number; // Width as percentage of original page width
    heightPct: number; // Height as percentage of original page height
}

interface PlacingItemInfo { type: 'signature' | 'stamp' | 'qrcode'; url?: string; width: number; height: number; }

interface UploadedFileInfo { id: string; name: string; url: string; size: number; type: string; }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const ZOOM_STEP = 0.2;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3.0;
const QR_PLACEHOLDER_COLOR = 'rgba(0, 150, 50, 0.7)';
const QR_PLACEHOLDER_TEXT = 'QR';

export default function LetterPdfReviewPage() {
    const router = useRouter();
    const params = useParams();
    const letterId = params?.letterId as string | undefined;

    const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
    const [letterDetails, setLetterDetails] = useState<LetterDetails | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null); // URL for the existing signed PDF
    const [isLoading, setIsLoading] = useState(true);
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfScale, setPdfScale] = useState<number>(1.0);
    const [isReassignModalVisible, setIsReassignModalVisible] = useState(false);
    const [reassignTargetUserId, setReassignTargetUserId] = useState<string | null>(null);
    const [reassignOptions, setReassignOptions] = useState<UserInfo[]>([]);
    const [approvalComment, setApprovalComment] = useState('');
    const [actionComment, setActionComment] = useState(''); // Used for Reject/Reassign comments
    const [resubmitComment, setResubmitComment] = useState(''); // Used for Resubmit comment

    const [isSigningMode, setIsSigningMode] = useState<boolean>(false); // Whether we are in resubmit-signing mode
    const [processingPdfInfo, setProcessingPdfInfo] = useState<UploadedFileInfo | null>(null); // Info about the newly uploaded PDF
    const [processingPdfUrl, setProcessingPdfUrl] = useState<string | null>(null); // Blob URL for the newly uploaded PDF
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]); // Items placed in signing mode
    const [placingItem, setPlacingItem] = useState<PlacingItemInfo | null>(null); // Item currently being placed
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([]);
    const [savedStamps, setSavedStamps] = useState<StampData[]>([]);
    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null);
    const [selectedStampUrl, setSelectedStampUrl] = useState<string | null>(null);
    const [isProcessingResubmit, setIsProcessingResubmit] = useState<boolean>(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);

    // Store original page dimensions (scale 1) for correct percentage calculations
    const [pageDimensions, setPageDimensions] = useState<{ [key: number]: { width: number; height: number } }>({});

    const pdfContainerRef = useRef<HTMLDivElement>(null); // Reference to the main PDF container

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
            setPdfUrl(null);
            // Reset signing mode states when fetching a new letter
            setIsSigningMode(false);
            setProcessingPdfInfo(null);
            if (processingPdfUrl) URL.revokeObjectURL(processingPdfUrl);
            setProcessingPdfUrl(null);
            setPlacedItems([]);
            setPlacingItem(null);
            setFileList([]);
            setPageDimensions({}); // Clear dimensions for new letter
            setPageNumber(1);
            setNumPages(null);
            setPdfScale(1.0);

            try {
                const details = await apiRequest<LetterDetails>(`/letters/${letterId}`);
                setLetterDetails(details);
                if (details.signedPdfUrl) {
                    const urlResponse = await apiRequest<{ viewUrl: string }>(`/letters/${letterId}/view-url`);
                    setPdfUrl(urlResponse.viewUrl);
                } else {
                    setPdfUrl(null);
                }
            } catch (err: any) {
                console.error("Error fetching letter details or PDF URL:", err);
                setError(err.message || "An error occurred while loading the letter.");
                setLetterDetails(null);
                setPdfUrl(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        return () => {
            if (processingPdfUrl) {
                URL.revokeObjectURL(processingPdfUrl);
                setProcessingPdfUrl(null);
            }
        };
    }, [letterId]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const sigsRaw = localStorage.getItem('signatures_r2');
                const parsedSigs = sigsRaw ? JSON.parse(sigsRaw) : [];
                if (Array.isArray(parsedSigs)) {
                    setSavedSignatures(parsedSigs.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt, })));
                } else { setSavedSignatures([]); }
            } catch (e) { console.error("Failed to load/parse signatures", e); setSavedSignatures([]); }
            try {
                const stmpsRaw = localStorage.getItem('stamps_r2');
                const parsedStamps = stmpsRaw ? JSON.parse(stmpsRaw) : [];
                if (Array.isArray(parsedStamps)) {
                    setSavedStamps(parsedStamps.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt, })));
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
                    if (letterDetails.nextActionById) currentWorkflowUserIds.add(letterDetails.nextActionById);
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

    const handleApprove = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction) return;
        if (!actionComment.trim()) {
            message.error("Approval reason/comment cannot be empty.");
            return;
        }
        setIsActionLoading(true);
        message.loading({ content: 'Processing approval...', key: 'action' });
        try {
            const isFinalApproval = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            
            
            
            
            const endpoint = isFinalApproval ? `/letters/${letterId}/final-approve` : `/letters/${letterId}/approve-review`;
            const payload: { comment: string; placements?: PlacementInfoForDisplay[] } = { comment: actionComment };

            if (isFinalApproval) {
                const placementsForBackend: PlacementInfoForDisplay[] = placedItems.map(item => {
                  const dims = pageDimensions[item.pageNumber];
                  if (!dims) {
                    throw new Error(`Dimensions for page ${item.pageNumber} not found.`);
                  }
          
                  // Convert percentages to absolute coordinates
                  const x = item.xPct * dims.width;
                  const y = item.yPct * dims.height;
                  const width = item.widthPct * dims.width;
                  const height = item.heightPct * dims.height;
          
                  return {
                    type: item.type,
                    url: item.url || '', // Ensure a valid URL is provided
                    pageNumber: item.pageNumber,
                    x,
                    y,
                    width,
                    height,
                  };
                });
          
                payload.placements = placementsForBackend;
              }


            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Action successful!', key: 'action', duration: 2 });
            setActionComment('');
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
        message.loading({ content: 'Processing rejection...', key: 'action' });
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
    const handleReassignCancel = () => {
        setIsReassignModalVisible(false);
        setReassignTargetUserId(null);
    }
    const handleReassignSubmit = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction || !reassignTargetUserId) {
            message.error("Please select a user to reassign to.");
            return;
        }
        if (!actionComment.trim()) {
            message.error("Reassign reason/comment cannot be empty.");
            return;
        }
        setIsActionLoading(true);
        setIsReassignModalVisible(false);
        message.loading({ content: 'Processing reassignment...', key: 'action' });
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

        if (isSigningMode && processingPdfInfo) {
            const hasSignature = placedItems.some(item => item.type === 'signature');
            const hasStamp = placedItems.some(item => item.type === 'stamp');
            if (!hasSignature || !hasStamp) {
                message.warning('Please place at least one signature and one stamp on the document.');
                return;
            }

            setIsProcessingResubmit(true);
            setIsActionLoading(true);
            message.loading({ content: 'Generating signed PDF...', key: 'resubmit-action', duration: 0 });

            try {
                if (!processingPdfUrl) {
                    throw new Error("No PDF available for processing.");
                }
                const response = await fetch(processingPdfUrl, { credentials: 'include' });
                if (!response.ok) throw new Error(`Failed to fetch uploaded PDF: ${response.statusText}`);
                const pdfBytes = await response.arrayBuffer();
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pages = pdfDoc.getPages();

                if (pages.length !== numPages) {
                    console.warn("Number of pages in loaded PDF doesn't match expected count.");
                }

                for (const item of placedItems) {
                    if (item.pageNumber < 1 || item.pageNumber > pages.length) {
                        console.warn(`Skipping placement for item on invalid page ${item.pageNumber}`);
                        continue;
                    }

                    const page = pages[item.pageNumber - 1];
                    const pageDims = page.getSize();

                    if (item.type === 'qrcode') {
                        console.log('Skipping QR code placeholder in PDF generation');
                        continue;
                    }

                    if (!item.url) {
                        console.warn(`Skipping placement for item with no URL`);
                        continue;
                    }

                    let imageBytes: Buffer | null = null;
                    try {
                        const imgResponse = await axios.get(item.url, { responseType: 'arraybuffer', withCredentials: false });
                        imageBytes = Buffer.from(imgResponse.data);
                    } catch (fetchError: any) {
                        console.warn(`Skipping placement (fetch error for image ${item.url}): ${fetchError.message}`);
                        continue;
                    }
                    if (!imageBytes) continue;

                    let pdfImage: PDFImage | null = null;
                    try {
                        if (item.url.toLowerCase().endsWith('.png')) pdfImage = await pdfDoc.embedPng(imageBytes);
                        else if (item.url.toLowerCase().endsWith('.jpg') || item.url.toLowerCase().endsWith('.jpeg')) pdfImage = await pdfDoc.embedJpg(imageBytes);
                        else {
                            console.warn(`Skipping placement (unsupported image format): ${item.url}`);
                            continue;
                        }
                    } catch (embedError: any) {
                        console.error(`Failed to embed image ${item.url}: ${embedError.message}`);
                        continue;
                    }
                    if (!pdfImage) continue;

                    const absX = item.xPct * pageDims.width;
                    const absY = item.yPct * pageDims.height;
                    const absWidth = item.widthPct * pageDims.width;
                    const absHeight = item.heightPct * pageDims.height;

                    const pdfLibY = pageDims.height - absY - absHeight;

                    try {
                        page.drawImage(pdfImage, { x: absX, y: pdfLibY, width: absWidth, height: absHeight });
                    } catch (drawError: any) {
                        console.error(`Failed to draw image ${item.url} on page ${item.pageNumber}: ${drawError.message}`);
                        continue;
                    }
                }

                const finalPdfBytes = await pdfDoc.save();
                message.loading({ content: 'Uploading signed PDF...', key: 'resubmit-action', duration: 0 });

                const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
                const formData = new FormData();
                const originalNameNoExt = processingPdfInfo.name.substring(0, processingPdfInfo.name.lastIndexOf('.')) || 'resubmitted-letter';
                const signedFilename = `${originalNameNoExt}-signed-${Date.now()}.pdf`;
                formData.append('files', blob, signedFilename);

                const authToken = typeof window !== 'undefined' ? localStorage.getItem('access_token_w') : null;

                if (!authToken) {
                    message.error('Authentication token not found. Please log in again.');
                    setIsProcessingResubmit(false);
                    setIsActionLoading(false);
                    return;
                }

                const uploadResponse = await fetch(`${API_BASE_URL}/files/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                if (!uploadResponse.ok) {
                    let errorBody = 'Upload failed';
                    try {
                        const errorJson = await uploadResponse.json();
                        errorBody = errorJson.message || errorBody;
                    } catch (e) { }
                    throw new Error(`Failed to upload signed PDF: ${uploadResponse.statusText} (${errorBody})`);
                }

                const uploadResultData = await uploadResponse.json();

                let newSignedFileId: string | null = null;

                if (
                    typeof uploadResultData === 'object' &&
                    uploadResultData !== null &&
                    Array.isArray(uploadResultData.files) &&
                    uploadResultData.files.length > 0 &&
                    uploadResultData.files[0].id
                ) {
                    newSignedFileId = uploadResultData.files[0].id;
                }

                if (!newSignedFileId) {
                    console.error("Unexpected upload response format:", uploadResultData);
                    throw new Error('Upload successful, but could not extract file ID from backend response.');
                }

                message.loading({ content: 'Submitting resubmission...', key: 'resubmit-action', duration: 0 });

                const endpoint = `/letters/${letterId}/resubmit`;
                const payload = { comment: resubmitComment, newSignedFileId: newSignedFileId };
                await apiRequest(endpoint, 'POST', payload);

                message.success({ content: 'Letter resubmitted successfully!', key: 'resubmit-action', duration: 2 });

                setResubmitComment('');
                setProcessingPdfInfo(null);
                if (processingPdfUrl) URL.revokeObjectURL(processingPdfUrl);
                setProcessingPdfUrl(null);
                setPlacedItems([]);
                setPlacingItem(null);
                setIsSigningMode(false);
                setFileList([]);
                setNumPages(null);
                setPageDimensions({});
                setPdfScale(1.0);
                setPageNumber(1);

                router.push('/dashboard/MyStaff');

            } catch (apiError: any) {
                message.error({ content: `Failed to resubmit signed letter: ${apiError.message || 'Unknown error'}`, key: 'resubmit-action', duration: 4 });
            } finally {
                setIsProcessingResubmit(false);
                setIsActionLoading(false);
            }

        } else {
            setIsActionLoading(true);
            message.loading({ content: 'Resubmitting letter...', key: 'resubmit-action', duration: 0 });
            try {
                const endpoint = `/letters/${letterId}/resubmit`;
                const payload: { comment: string; newSignedFileId?: string } = {
                    comment: resubmitComment
                };

                await apiRequest(endpoint, 'POST', payload);
                message.success({ content: 'Letter resubmitted successfully!', key: 'resubmit-action', duration: 2 });
                setResubmitComment('');

                setProcessingPdfInfo(null);
                if (processingPdfUrl) URL.revokeObjectURL(processingPdfUrl);
                setProcessingPdfUrl(null);
                setPlacedItems([]);
                setPlacingItem(null);
                setIsSigningMode(false);
                setFileList([]);
                setNumPages(null);
                setPageDimensions({});
                setPdfScale(1.0);
                setPageNumber(1);

                router.push('/dashboard/MyStaff');

            } catch (apiError: any) {
                message.error({ content: `Failed to resubmit letter: ${apiError.message || 'Unknown error'}`, key: 'resubmit-action', duration: 4 });
            } finally {
                setIsActionLoading(false);
            }
        }
    };

    const handleZoomIn = () => setPdfScale(prev => Math.min(prev + ZOOM_STEP, MAX_SCALE));
    const handleZoomOut = () => setPdfScale(prev => Math.max(prev - ZOOM_STEP, MIN_SCALE));
    const handleResetZoom = () => setPdfScale(1.0);

    const handleSelectSignatureForPlacing = (sig: SignatureData) => {
        setPlacingItem({ type: 'signature', url: sig.r2Url, width: 100, height: 40 });
        setSelectedSignatureUrl(sig.r2Url);
        setSelectedStampUrl(null);
        message.info('Click on the PDF page to place the signature.');
    };

    const handleSelectStampForPlacing = (stamp: StampData) => {
        setPlacingItem({ type: 'stamp', url: stamp.r2Url, width: 60, height: 60 });
        setSelectedStampUrl(stamp.r2Url);
        setSelectedSignatureUrl(null);
        message.info('Click on the PDF page to place the stamp.');
    };

    const handlePdfAreaClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!(isSigningMode || isFinalApprovalSigningMode) || !placingItem) return;

        const pageEl = (event.target as HTMLElement).closest('.react-pdf__Page') as HTMLElement | null;
        if (!pageEl) return;

        const pageRect = pageEl.getBoundingClientRect();

        const clickX_scaled = event.clientX - pageRect.left;
        const clickY_scaled = event.clientY - pageRect.top;

        const originalDims = pageDimensions[pageNumber];
        if (!originalDims) {
            console.error(`Original dimensions not available for page ${pageNumber}`);
            message.error("Could not get page dimensions for placement.");
            return;
        }

        const clickX_unscaled = clickX_scaled / pdfScale;
        const clickY_unscaled = clickY_scaled / pdfScale;

        const itemOriginalWidth = placingItem.width;
        const itemOriginalHeight = placingItem.height;

        const itemTopLeftX_unscaled = clickX_unscaled - itemOriginalWidth / 2;
        const itemTopLeftY_unscaled = clickY_unscaled - itemOriginalHeight / 2;

        const xPct = itemTopLeftX_unscaled / originalDims.width;
        const yPct = itemTopLeftY_unscaled / originalDims.height;
        const widthPct = itemOriginalWidth / originalDims.width;
        const heightPct = itemOriginalHeight / originalDims.height;

        if (xPct < -0.1 || xPct > 1.1 || yPct < -0.1 || yPct > 1.1) {
            console.warn("Calculated placement position seems off, skipping:", { xPct, yPct });
            message.warning("Placement position is outside the page bounds.");
            return;
        }

        const newItem: PlacedItem = {
            id: uuidv4(),
            type: placingItem.type,
            url: placingItem.url || '',
            pageNumber,
            xPct: Math.max(0, xPct),
            yPct: Math.max(0, yPct),
            widthPct: widthPct,
            heightPct: heightPct
        };

        setPlacedItems(p => [...p, newItem]);
        setPlacingItem(null);
        setSelectedSignatureUrl(null);
        setSelectedStampUrl(null);
        message.success(`${placingItem.type.charAt(0).toUpperCase() + placingItem.type.slice(1)} placed on page ${pageNumber}.`);
    }, [isSigningMode, placingItem, pageNumber, pdfScale, pageDimensions, isFinalApprovalSigningMode]);

    const handleRemovePlacedItem = (itemId: string) => {
        setPlacedItems(prevItems => prevItems.filter(item => item.id !== itemId));
        message.info('Placed item removed.');
    };

    const uploadProps: UploadProps = {
        name: 'pdfFile',
        multiple: false,
        beforeUpload: (file) => {
            const isPdf = file.type === 'application/pdf';
            if (!isPdf) {
                message.error(`${file.name} is not a PDF file`);
            }
            const isLt15M = file.size / 1024 / 1024 < 15;
            if (!isLt15M) {
                message.error('PDF must be smaller than 15MB!');
            }
            if (isPdf && isLt15M) {
                if (processingPdfUrl) {
                    URL.revokeObjectURL(processingPdfUrl);
                }
                const blobUrl = URL.createObjectURL(file);
                setProcessingPdfUrl(blobUrl);
                setProcessingPdfInfo({
                    id: file.uid,
                    name: file.name,
                    url: blobUrl,
                    size: file.size,
                    type: file.type,
                });
                setFileList([file]);
                setIsSigningMode(true);
                setPlacedItems([]);
                setPageNumber(1);
                setPdfLoadError(null);
                setPdfScale(1.0);
                setNumPages(null);
                setPageDimensions({});
            }
            return false;
        },
        accept: ".pdf",
        maxCount: 1,
        fileList: fileList,
        onRemove: (file) => {
            if (processingPdfUrl) {
                URL.revokeObjectURL(processingPdfUrl);
            }
            setProcessingPdfInfo(null);
            setProcessingPdfUrl(null);
            setIsSigningMode(false);
            setPlacedItems([]);
            setPlacingItem(null);
            setSelectedSignatureUrl(null);
            setSelectedStampUrl(null);
            setFileList([]);
            setNumPages(null);
            setPageDimensions({});
            setPdfScale(1.0);
            setPageNumber(1);
            setPdfLoadError(null);
            message.info('Uploaded PDF removed.');
            return true;
        },
    };

    const renderActionButtons = () => {
        if (isUserLoading) return <Spin size="small" />;
        if (canTakeAction) {
            const isFinalApprovalStep = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            return (
                <Space wrap>
                    <Button danger icon={<CloseOutlined />} onClick={handleReject} loading={isActionLoading} disabled={isActionLoading || isProcessingResubmit || (isFinalApprovalStep && !actionComment.trim()) || (!isFinalApprovalStep && !actionComment.trim())}> Reject </Button>
                    {!isFinalApprovalStep && ( <Button icon={<SendOutlined />} onClick={showReassignModal} loading={isActionLoading} disabled={isActionLoading || isProcessingResubmit || !actionComment.trim()}> Reassign </Button> )}
                    <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove} loading={isActionLoading} disabled={isActionLoading || isProcessingResubmit}> {isFinalApprovalStep ? 'Final Approve' : 'Approve Step'} </Button>
                </Space>
            );
        } else if (isSubmitterOfRejectedLetter) {
            const canResubmit = !isActionLoading && !isProcessingResubmit && resubmitComment.trim();
            const requiresPlacements = isSigningMode && (!placedItems.some(i=>i.type==='signature') || !placedItems.some(i=>i.type==='stamp'));
            return (
                <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={handleResubmit}
                    loading={isActionLoading || isProcessingResubmit}
                    disabled={!canResubmit || requiresPlacements }
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
    const formatStatus = (status: string): string => { return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'; };
    const formatActionType = (action: string): string => { return action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Action'; };
    const getUserFullName = (user?: UserInfo | null): string => { if (!user) return 'System/Unknown'; return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unnamed User'; };
    const getInitials = (user?: UserInfo | null): string => { if (!user) return 'S'; const first = user.firstName?.[0] || ''; const last = user.lastName?.[0] || ''; return (first + last).toUpperCase() || user.email?.[0].toUpperCase() || '?'; };
    const submitterName = useMemo(() => getUserFullName(letterDetails?.user), [letterDetails]);

    const currentPdfSource = isSigningMode ? processingPdfUrl : pdfUrl;
    const pdfKey = isSigningMode ? processingPdfInfo?.id : letterDetails?.id;

    const renderContent = () => {
        if (isLoading || isUserLoading) { return <div className="text-center p-20"><Spin size="large" tip="Loading Letter..." /></div>; }
        if (error && !isSigningMode) { return <Alert message="Error Loading Letter" description={error} type="error" showIcon closable onClose={() => setError(null)} />; }
        if (!letterDetails) { return <Alert message="Letter Not Found" description="The requested letter could not be loaded." type="warning" showIcon />; }

        const showResubmitSection = isSubmitterOfRejectedLetter;
        const showActionCommentArea = canTakeAction || (isSubmitterOfRejectedLetter && !isSigningMode);

        return (
            <>
                {showResubmitSection && (
                    <Card className="mb-4" title="Resubmit Letter">
                        <Paragraph type="warning">This letter was rejected. Review comments, optionally upload & sign a new PDF, add a required comment, and resubmit.</Paragraph>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Dragger {...uploadProps} disabled={isActionLoading || isProcessingResubmit}>
                                <p className="ant-upload-drag-icon"> <InboxOutlined /> </p>
                                <p className="ant-upload-text">Click or drag a new PDF file here to replace and sign (Optional)</p>
                                <p className="ant-upload-hint">Supports single PDF file up to 15MB.</p>
                            </Dragger>
                            {!isSigningMode && (
                                <TextArea rows={4} placeholder="Comment explaining changes (required)..." value={resubmitComment} onChange={(e) => setResubmitComment(e.target.value)} disabled={isActionLoading || isProcessingResubmit} />
                            )}
                        </Space>
                    </Card>
                )}

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={16}>
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col">
                            <div className="flex justify-between items-center p-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                                <div>
                                    {numPages && numPages > 1 && (
                                        <Space>
                                            <Button onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))} disabled={pageNumber <= 1} size="small">Previous</Button>
                                            <span> Page {pageNumber} of {numPages} </span>
                                            <Button onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))} disabled={pageNumber >= numPages} size="small">Next</Button>
                                        </Space>
                                    )}
                                    {!numPages && (isSigningMode ? pdfLoadError : error) && <span className='text-red-500 text-xs'>Page info unavailable</span>}
                                    {!numPages && !(isSigningMode ? pdfLoadError : error) && currentPdfSource && !isLoading && <span className='text-gray-500 text-xs'>Loading page info...</span>}
                                    {!currentPdfSource && <span className='text-gray-500 text-xs'>No PDF document</span>}
                                </div>
                                <Space>
                                    <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= MIN_SCALE || !numPages || !currentPdfSource} size="small" />
                                    <Tooltip title="Reset Zoom"><Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1.0 || !numPages || !currentPdfSource} size="small" /></Tooltip>
                                    <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= MAX_SCALE || !numPages || !currentPdfSource} size="small" />
                                    <span className="text-sm font-semibold w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                                </Space>
                            </div>
                            <div
                                ref={pdfContainerRef}
                                className="flex-1 overflow-auto p-2 relative bg-gray-50"
                                onClick={(isSigningMode || isFinalApprovalSigningMode) && placingItem ? handlePdfAreaClick : undefined}
                                style={{ cursor: (isSigningMode || isFinalApprovalSigningMode) && placingItem ? 'copy' : 'default' }}
                            >
                                {currentPdfSource ? (
                                    <Document
                                        key={pdfKey}
                                        file={currentPdfSource}
                                        onLoadSuccess={({ numPages: totalPages }) => {
                                            setNumPages(totalPages);
                                            setPdfLoadError(null);
                                            setPageDimensions({});
                                        }}
                                        onLoadError={(err) => {
                                            console.error("PDF Load Error:", err);
                                            setPdfLoadError(`Failed to load PDF: ${err.message}`);
                                            setNumPages(null);
                                            setPageDimensions({});
                                        }}
                                        loading={<div className="text-center p-10"><Spin tip="Loading PDF..." /></div>}
                                        error={<Alert message="Error" description={pdfLoadError || "Could not load PDF document."} type="error" showIcon />}
                                        className="flex justify-center items-start"
                                    >
                                        <Page
                                            key={`page_${pageNumber}_${pdfScale}`}
                                            pageNumber={pageNumber}
                                            scale={pdfScale}
                                            onLoadSuccess={p => {
                                                const viewport = p.getViewport({ scale: 1 });
                                                setPageDimensions(d => ({ ...d, [pageNumber]: { width: viewport.width, height: viewport.height } }));
                                            }}
                                            renderTextLayer
                                            renderAnnotationLayer={false}
                                            className="shadow-lg"
                                            loading={<div style={{ height: '500px' }}><Spin /></div>}
                                        >
                                            {(isSigningMode || isFinalApprovalSigningMode) && placedItems.filter(item => item.pageNumber === pageNumber).map((item, index) => {
                                                const dims = pageDimensions[item.pageNumber];
                                                if (!dims) return null;

                                                const left = item.xPct * dims.width * pdfScale;
                                                const top = item.yPct * dims.height * pdfScale;
                                                const width = item.widthPct * dims.width * pdfScale;
                                                const height = item.heightPct * dims.height * pdfScale;

                                                return (
                                                    <div
                                                        key={index}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${left}px`,
                                                            top: `${top}px`,
                                                            width: `${width}px`,
                                                            height: `${height}px`,
                                                        }}
                                                    >
                                                        <img src={item.url} alt="Placed item" style={{ width: '100%', height: '100%' }} />
                                                    </div>
                                                );
                                            })}

                                            {!isSigningMode && letterDetails?.placements?.filter(item => item.pageNumber === pageNumber).map((item, index) => {
                                                const dims = pageDimensions[item.pageNumber];
                                                if (!dims) return null;

                                                const scaledX = item.x * pdfScale;
                                                const scaledY = item.y * pdfScale;
                                                const scaledWidth = item.width * pdfScale;
                                                const scaledHeight = item.height * pdfScale;

                                                return (
                                                    <div
                                                        key={index}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${scaledX}px`,
                                                            top: `${scaledY}px`,
                                                            width: `${scaledWidth}px`,
                                                            height: `${scaledHeight}px`,
                                                        }}
                                                    >
                                                        {item.type === 'qrcode' ? (
                                                            <div 
                                                                style={{ 
                                                                    width: '100%', 
                                                                    height: '100%', 
                                                                    backgroundColor: QR_PLACEHOLDER_COLOR,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: 'white',
                                                                    fontWeight: 'bold',
                                                                    border: '2px dashed white',
                                                                    borderRadius: '4px'
                                                                }}
                                                            >
                                                                {QR_PLACEHOLDER_TEXT}
                                                            </div>
                                                        ) : (
                                                            <img src={item.url} alt="Existing placement" style={{ width: '100%', height: '100%' }} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </Page>
                                    </Document>
                                ) : ( <Alert message="No PDF Available" description={isSubmitterOfRejectedLetter ? "Upload a new PDF to resubmit or wait for letter details to load." : "No PDF document is available for this letter."} type="warning" showIcon /> )}
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} lg={8}>
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 space-y-4" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'auto', overflowY: 'auto' }}>
                            {isFinalApprovalSigningMode && (
                                <div className="border-b pb-4 mb-4 space-y-3">
                                    <Title level={5} style={{ marginBottom: '8px' }}>Select Signature & Stamp</Title>
                                    <div>
                                        <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Signature</Typography.Title>
                                        {savedSignatures.length === 0 ? (<Typography.Text type="secondary">No signatures saved...</Typography.Text>) : (
                                            <div className="flex flex-wrap gap-2">
                                                {savedSignatures.map(sig => (
                                                    <button
                                                        key={sig.id}
                                                        type="button"
                                                        onClick={() => handleSelectSignatureForPlacing(sig)}
                                                        className={`p-1 border rounded-md transition-all ${selectedSignatureUrl === sig.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                                        title={sig.name || 'Signature'}
                                                    >
                                                        <AntImage src={sig.r2Url} alt={sig.name || 'Signature'} width={80} height={35} preview={false} className="object-contain" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Stamp</Typography.Title>
                                        {savedStamps.length === 0 ? (<Typography.Text type="secondary">No stamps saved...</Typography.Text>) : (
                                            <div className="flex flex-wrap gap-2">
                                                {savedStamps.map(stamp => (
                                                    <button
                                                        key={stamp.id}
                                                        type="button"
                                                        onClick={() => handleSelectStampForPlacing(stamp)}
                                                        className={`p-1 border rounded-full transition-all ${selectedStampUrl === stamp.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                                        title={stamp.name || 'Stamp'}
                                                    >
                                                        <AntImage src={stamp.r2Url} alt={stamp.name || 'Stamp'} width={45} height={45} preview={false} className="object-contain rounded-full" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!isSigningMode && letterDetails && (
                                <>
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
                                                placeholder={canTakeAction ? "Enter reason for rejection, note for reassignment, or comment for approval..." : "Comment explaining changes (required)..."}
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
                                </>
                            )}
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
                    <Title level={3} className="mb-0 truncate"> Review Letter: {letterDetails?.name || (letterId ? `ID ${letterId.substring(0, 8)}...` : '')} </Title>
                </div>
                <div className="flex justify-end flex-grow">
                    {renderActionButtons()}
                </div>
            </div>
            {!isLoading && letterDetails && !isSigningMode && (
                <div className="mb-4 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                    Submitted by: <span className="font-semibold">{submitterName}</span> on <span className="font-semibold">{new Date(letterDetails.createdAt).toLocaleDateString('en-CA')}</span>
                    <span className="ml-4 pl-4 border-l border-gray-300">Current Status: <Tag color={getStatusColor(letterDetails.workflowStatus)}>{formatStatus(letterDetails.workflowStatus)}</Tag></span>
                </div>
            )}
            {error && isSigningMode && <Alert message="PDF Load Error" description={error} type="error" showIcon closable onClose={() => setError(null)} className="mb-4" />}

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

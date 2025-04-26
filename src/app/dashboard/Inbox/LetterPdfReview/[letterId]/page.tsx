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
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token_w') : null;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const config: RequestInit = { method, headers };
    if (body) { config.body = JSON.stringify(body); }
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}${endpoint}`, config);
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! Status: ${response.status}` };
        try { errorData = await response.json(); } catch (e) {}
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
interface PlacedItem { id: string; type: 'signature' | 'stamp'; url: string; pageNumber: number; x: number; y: number; width: number; height: number; }
interface PlacingItemInfo { type: 'signature' | 'stamp'; url: string; width: number; height: number; }
interface UploadedFileInfo { id: string; name: string; url: string; size: number; type: string; }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function LetterPdfReviewPage() {
    const router = useRouter();
    const params = useParams();
    const letterId = params?.letterId as string | undefined;

    const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
    const [letterDetails, setLetterDetails] = useState<LetterDetails | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
    const [actionComment, setActionComment] = useState('');
    const [resubmitComment, setResubmitComment] = useState('');

    const [isSigningMode, setIsSigningMode] = useState<boolean>(false);
    const [processingPdfInfo, setProcessingPdfInfo] = useState<UploadedFileInfo | null>(null);
    const [processingPdfUrl, setProcessingPdfUrl] = useState<string | null>(null);
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
    const [placingItem, setPlacingItem] = useState<PlacingItemInfo | null>(null);
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([]);
    const [savedStamps, setSavedStamps] = useState<StampData[]>([]);
    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null);
    const [selectedStampUrl, setSelectedStampUrl] = useState<string | null>(null);
    const [isProcessingResubmit, setIsProcessingResubmit] = useState<boolean>(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);

    const [pageDims, setPageDims] = useState<{[k:number]:{w:number,h:number}}>({})


    const pdfContainerRef = useRef<HTMLDivElement>(null);

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
            setIsSigningMode(false);
            setProcessingPdfInfo(null);
            setProcessingPdfUrl(null);
            setPlacedItems([]);
            try {
                const details = await apiRequest<LetterDetails>(`/letters/${letterId}`);
                setLetterDetails(details);
                if (details.signedPdfUrl) {
                     const urlResponse = await apiRequest<{ viewUrl: string }>(`/letters/${letterId}/view-url`);
                     setPdfUrl(urlResponse.viewUrl);
                }
            } catch (err: any) {
                console.error("Error fetching letter details or PDF URL:", err);
                setError(err.message || "An error occurred while loading the letter.");
                setLetterDetails(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [letterId]);

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
        const currentUrl = processingPdfUrl;
        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [processingPdfUrl]);

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

    const handleApprove = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction) return;
        setIsActionLoading(true);
        message.loading({ content: 'Processing approval...', key: 'action' });
        try {
            const isFinalApproval = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            const endpoint = isFinalApproval ? `/letters/${letterId}/final-approve` : `/letters/${letterId}/approve-review`;
            const payload = { comment: approvalComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Action successful!', key: 'action', duration: 2 });
            setActionComment('');
            setApprovalComment('');
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
            setApprovalComment('');
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
         message.loading({ content: 'Processing reassignment...', key: 'action' });
         try {
            const endpoint = `/letters/${letterId}/reassign`;
            const payload = { newUserId: reassignTargetUserId, reason: actionComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Reassignment successful!', key: 'action', duration: 2 });
            setReassignTargetUserId(null);
            setActionComment('');
            setApprovalComment('');
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

        if (isSigningMode && processingPdfInfo && placedItems.length > 0) {
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
                const response = await fetch(processingPdfUrl!);
                const pdfBytes = await response.arrayBuffer();
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pages = pdfDoc.getPages();

                for (const item of placedItems) {
                    if (item.pageNumber < 1 || item.pageNumber > pages.length) continue;
                    let imageBytes: Buffer | null = null;
                    try {
                        const imgResponse = await axios.get(item.url, { responseType: 'arraybuffer' });
                        imageBytes = Buffer.from(imgResponse.data);
                    } catch (fetchError: any) { console.warn(`Skipping placement (fetch error): ${item.url}`); continue; }
                    if (!imageBytes) continue;

                    let pdfImage: PDFImage | null = null;
                     try {
                        if (item.url.toLowerCase().endsWith('.png')) pdfImage = await pdfDoc.embedPng(imageBytes);
                        else if (item.url.toLowerCase().endsWith('.jpg') || item.url.toLowerCase().endsWith('.jpeg')) pdfImage = await pdfDoc.embedJpg(imageBytes);
                        else continue;
                    } catch(embedError: any) { console.error(`Failed to embed image ${item.url}: ${embedError.message}`); continue; }
                    if (!pdfImage) continue;

                    const page = pages[item.pageNumber - 1];
                    const { width: pageWidth, height: pageHeight } = page.getSize();
                    const pdfX = item.x;
                    const pdfY = pageHeight - item.y - item.height; // Convert Y from top-left to bottom-left for pdf-lib
                    try {
                        page.drawImage(pdfImage, { x: pdfX, y: pdfY, width: item.width, height: item.height });
                    } catch (drawError: any) { console.error(`Failed to draw image ${item.url} on page ${item.pageNumber}: ${drawError.message}`); continue; }
                }

                const finalPdfBytes = await pdfDoc.save();
                message.loading({ content: 'Uploading signed PDF...', key: 'resubmit-action', duration: 0 });

                const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
                const formData = new FormData();
                const originalNameNoExt = processingPdfInfo.name.substring(0, processingPdfInfo.name.lastIndexOf('.')) || 'resubmitted-letter';
                const signedFilename = `${originalNameNoExt}-signed-${Date.now()}.pdf`;
                formData.append('files', blob, signedFilename);

                 const token = typeof window !== 'undefined' ? localStorage.getItem('access_token_w') : null;
                 const uploadHeaders: HeadersInit = {};
                 if (token) { uploadHeaders['Authorization'] = `Bearer ${token}`; }

                 const uploadResponse = await fetch(`${API_BASE_URL}/files/upload`, {
                     method: 'POST',
                     headers: uploadHeaders,
                     body: formData,
                 });

                 if (!uploadResponse.ok) {
                     let errorBody = 'Upload failed';
                     try {
                         const errorJson = await uploadResponse.json();
                         errorBody = errorJson.message || errorBody;
                     } catch (e) {}
                     throw new Error(`Failed to upload signed PDF: ${uploadResponse.statusText} (${errorBody})`);
                 }

                const uploadResultData = await uploadResponse.json();

                let newSignedFileId: string | null = null;

                // --- UPDATED LOGIC to handle the { files: [...], message: ... } structure ---
                if (
                    typeof uploadResultData === 'object' &&
                    uploadResultData !== null &&
                    Array.isArray(uploadResultData.files) && // Check if 'files' is an array
                    uploadResultData.files.length > 0 &&     // Check if the array is not empty
                    uploadResultData.files[0].id              // Check if the first element has an 'id'
                ) {
                    newSignedFileId = uploadResultData.files[0].id; // Extract id from the first file in the array
                }
                // --- End UPDATED LOGIC ---

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
                setProcessingPdfUrl(null);
                setPlacedItems([]);
                setPlacingItem(null);
                setIsSigningMode(false);
                setFileList([]);
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
                setProcessingPdfUrl(null);
                setPlacedItems([]);
                setPlacingItem(null);
                setIsSigningMode(false);
                setFileList([]);
                router.push('/dashboard/MyStaff');
            } catch (apiError: any) {
                 message.error({ content: `Failed to resubmit letter: ${apiError.message || 'Unknown error'}`, key: 'resubmit-action', duration: 4 });
            } finally {
                setIsActionLoading(false);
            }
        }
    };


    const handleZoomIn = () => setPdfScale(prev => Math.min(prev + 0.2, 3.0));
    const handleZoomOut = () => setPdfScale(prev => Math.max(prev - 0.2, 0.4));
    const handleResetZoom = () => setPdfScale(1.0);

    const handleSelectSignatureForPlacing = (sig: SignatureData) => {
         setPlacingItem({ type: 'signature', url: sig.r2Url, width: 100, height: 40 });
         setSelectedSignatureUrl(sig.r2Url);
         setSelectedStampUrl(null);
     };

     const handleSelectStampForPlacing = (stamp: StampData) => {
         setPlacingItem({ type: 'stamp', url: stamp.r2Url, width: 60, height: 60 });
         setSelectedStampUrl(stamp.r2Url);
         setSelectedSignatureUrl(null);
     };

     const handlePdfAreaClick=(e:React.MouseEvent<HTMLDivElement>)=>{
        if(!isSigningMode||!placingItem) return
        const pageEl=(e.target as HTMLElement).closest('.react-pdf__Page') as HTMLElement|null
        if(!pageEl) return
        const r=pageEl.getBoundingClientRect()
        const clickX=e.clientX-r.left
        const clickY=e.clientY-r.top
        const xUnscaled=clickX/pdfScale
        const yUnscaled=clickY/pdfScale
        const finalX=xUnscaled-placingItem.width/2
        const finalY=yUnscaled-placingItem.height/2
        const newItem:PlacedItem={
          id:uuidv4(),
          type:placingItem.type,
          url:placingItem.url,
          pageNumber,
          x:finalX,
          y:finalY,
          width:placingItem.width,
          height:placingItem.height
        }
        setPlacedItems(p=>[...p,newItem])
        setPlacingItem(null)
        setSelectedSignatureUrl(null)
        setSelectedStampUrl(null)
      }


     const handleRemovePlacedItem = (itemId: string) => {
         setPlacedItems(prevItems => prevItems.filter(item => item.id !== itemId));
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
                message.error('PDF must smaller than 15MB!');
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
             setFileList([]);
             setNumPages(null);
            return true;
        },
    };


    const renderActionButtons = () => {
        if (isUserLoading) return <Spin size="small" />;
        if (canTakeAction) {
            const isFinalApprovalStep = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            return (
                <Space wrap>
                    <Button danger icon={<CloseOutlined />} onClick={handleReject} loading={isActionLoading} disabled={isActionLoading || isProcessingResubmit}> Reject </Button>
                    {!isFinalApprovalStep && ( <Button icon={<SendOutlined />} onClick={showReassignModal} loading={isActionLoading} disabled={isActionLoading || isProcessingResubmit}> Reassign </Button> )}
                    <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove} loading={isActionLoading} disabled={isActionLoading || isProcessingResubmit}> {isFinalApprovalStep ? 'Final Approve' : 'Approve Step'} </Button>
                </Space>
            );
        } else if (isSubmitterOfRejectedLetter) {
             return (
                <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={handleResubmit}
                    loading={isActionLoading || isProcessingResubmit}
                    disabled={isActionLoading || isProcessingResubmit || !resubmitComment.trim() || (isSigningMode && placedItems.length === 0) || (isSigningMode && (!placedItems.some(i=>i.type==='signature') || !placedItems.some(i=>i.type==='stamp'))) }
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

    const renderContent = () => {
        if (isLoading || isUserLoading) { return <div className="text-center p-20"><Spin size="large" tip="Loading Letter..." /></div>; }
        if (error && !isSigningMode) { return <Alert message="Error Loading Letter" description={error} type="error" showIcon closable onClose={() => setError(null)} />; }
        if (!letterDetails) { return <Alert message="Letter Not Found" description="The requested letter could not be loaded." type="warning" showIcon />; }

        const showResubmitSection = isSubmitterOfRejectedLetter;
        const showActionCommentArea = canTakeAction;
        const currentPdfSource = isSigningMode ? processingPdfUrl : pdfUrl;
        const pdfKey = isSigningMode ? processingPdfInfo?.id : letterDetails?.id;

        return (
            <>
                {showResubmitSection && (
                    <Card className="mb-4" title="Resubmit Letter">
                         <Paragraph type="warning">This letter was rejected. Review comments, optionally upload & sign a new PDF, add a required comment, and resubmit.</Paragraph>
                         <Space direction="vertical" style={{width: '100%'}}>
                             <Dragger {...uploadProps}>
                                 <p className="ant-upload-drag-icon"> <InboxOutlined /> </p>
                                 <p className="ant-upload-text">Click or drag a new PDF file here to replace and sign (Optional)</p>
                             </Dragger>
                             <TextArea rows={4} placeholder="Comment explaining changes (required)..." value={resubmitComment} onChange={(e) => setResubmitComment(e.target.value)} disabled={isActionLoading || isProcessingResubmit}/>
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
                                    {!numPages && !(isSigningMode ? pdfLoadError : error) && currentPdfSource && <span className='text-gray-500 text-xs'>Loading page info...</span>}
                                </div>
                                <Space>
                                     <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= 0.4 || !numPages} size="small" />
                                     <Tooltip title="Reset Zoom"><Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1.0 || !numPages} size="small" /></Tooltip>
                                     <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= 3.0 || !numPages} size="small" />
                                     <span className="text-sm font-semibold w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                                </Space>
                            </div>
                            <div
                                ref={pdfContainerRef}
                                className="flex-1 overflow-auto p-2 relative bg-gray-50"
                                onClick={isSigningMode ? handlePdfAreaClick : undefined}
                                style={{ cursor: isSigningMode && placingItem ? 'copy' : 'default' }}
                            >
                                 {currentPdfSource ? (
                                     <Document
                                         key={pdfKey}
                                         file={currentPdfSource}
                                         onLoadSuccess={({ numPages: totalPages }) => { setNumPages(totalPages); setPdfLoadError(null); }}
                                         onLoadError={(err) => { console.error("PDF Load Error:", err); setPdfLoadError(`Failed to load PDF: ${err.message}`); setNumPages(null); }}
                                         loading={<div className="text-center p-10"><Spin tip="Loading PDF..." /></div>}
                                         error={<Alert message="Error" description={pdfLoadError || "Could not load PDF document."} type="error" showIcon />}
                                         className="flex justify-center items-start"
                                     >
                                        <Page
                                            key={`page_${pageNumber}_${pdfScale}`}
                                            pageNumber={pageNumber}
                                            scale={pdfScale}
                                            onLoadSuccess={p => {
                                                const v = p.getViewport({ scale: 1 });
                                                setPageDims(d => ({ ...d, [pageNumber]: { w: v.width, h: v.height } }));
                                            }}
                                            renderTextLayer
                                            renderAnnotationLayer={false}
                                            className="shadow-lg"
                                            loading={<div style={{ height: '500px' }}><Spin /></div>}
                                        />
                                        {isSigningMode && placedItems.filter(i => i.pageNumber === pageNumber).map(i => (
                                            <Tooltip key={i.id} title="Click to remove">
                                                <img
                                                    src={i.url}
                                                    alt={i.type}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${i.x * pdfScale}px`,
                                                        top: `${i.y * pdfScale}px`,
                                                        width: `${i.width * pdfScale}px`,
                                                        height: `${i.height * pdfScale}px`,
                                                        cursor: 'pointer',
                                                        border: '1px dashed rgba(128,128,128,0.7)',
                                                        objectFit: 'contain',
                                                        userSelect: 'none',
                                                        transformOrigin: 'top left',
                                                        zIndex: 10
                                                    }}
                                                    onClick={e => { e.stopPropagation(); handleRemovePlacedItem(i.id); }}
                                                />
                                            </Tooltip>
                                        ))}
                                    </Document>
                                 ) : ( <Alert message="No PDF Available" description="Please upload a document or ensure the letter has a PDF." type="warning" showIcon /> )}
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} lg={8}>
                         <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 space-y-4" style={{display: 'flex', flexDirection: 'column' }}>
                             {isSigningMode && (
                                <div className="border-b pb-4 mb-4 space-y-3">
                                     <Title level={5} style={{ marginBottom: '8px' }}>Place Signature & Stamp</Title>
                                     {placingItem && (
                                         <Alert message={`Click on the PDF page ${pageNumber} to place the selected ${placingItem.type}.`} type="info" showIcon closable onClose={() => setPlacingItem(null)} />
                                     )}
                                     {!placingItem && placedItems.length > 0 && (
                                         <Alert message="Click on a placed item on the PDF to remove it." type="info" showIcon />
                                     )}
                                      <div>
                                          <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Signature</Typography.Title>
                                          {savedSignatures.length === 0 ? (<Typography.Text type="secondary">No signatures saved.</Typography.Text>) : (
                                              <div className="flex flex-wrap gap-2">
                                                  {savedSignatures.map(sig => (
                                                       <button
                                                            key={sig.id}
                                                            type="button"
                                                            onClick={() => handleSelectSignatureForPlacing(sig)}
                                                            className={`p-1 border rounded-md transition-all ${selectedSignatureUrl === sig.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                                            title={sig.name || `Signature`}
                                                        >
                                                            <AntImage src={sig.r2Url} alt={sig.name || 'Signature'} width={80} height={35} preview={false} className="object-contain" />
                                                        </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                     <div>
                                          <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Stamp</Typography.Title>
                                           {savedStamps.length === 0 ? (<Typography.Text type="secondary">No stamps saved.</Typography.Text>) : (
                                              <div className="flex flex-wrap gap-2">
                                                  {savedStamps.map(stamp => (
                                                       <button
                                                            key={stamp.id}
                                                            type="button"
                                                            onClick={() => handleSelectStampForPlacing(stamp)}
                                                            className={`p-1 border rounded-full transition-all ${selectedStampUrl === stamp.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                                            title={stamp.name || `Stamp`}
                                                        >
                                                            <AntImage src={stamp.r2Url} alt={stamp.name || 'Stamp'} width={45} height={45} preview={false} className="object-contain rounded-full" />
                                                        </button>
                                                  ))}
                                              </div>
                                           )}
                                      </div>
                                     {placedItems.length > 0 && (
                                         <div>
                                             <Typography.Title level={5} style={{ marginBottom: '8px' }}>Placed Items ({placedItems.length})</Typography.Title>
                                             <List size="small" bordered dataSource={placedItems} locale={{emptyText:"Click Signature/Stamp then click on PDF."}}
                                              renderItem={item => (
                                                  <List.Item
                                                      actions={[<Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemovePlacedItem(item.id)}>Remove</Button>]}
                                                  >
                                                      <List.Item.Meta
                                                          avatar={<Avatar size="small" src={item.url} />}
                                                          title={`${item.type.charAt(0).toUpperCase() + item.type.slice(1)} on page ${item.pageNumber}`}
                                                      />
                                                  </List.Item>
                                              )} />
                                         </div>
                                     )}
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
                                            <List itemLayout="horizontal" dataSource={letterDetails.letterActionLogs ?? []} locale={{emptyText: "No actions logged yet."}}
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
                                            <TextArea rows={3} placeholder="Enter reason for rejection or note for reassignment here..." value={actionComment} onChange={(e) => setActionComment(e.target.value)} disabled={isActionLoading}/>
                                            <Text type="secondary" className='text-xs'>This comment/reason will be saved when you click Reject or Reassign.</Text>
                                        </div>
                                     )}

                                    <div>
                                        <Title level={5} style={{ marginTop: '16px' }}>Reviewers & Approver</Title>
                                        <List size="small" dataSource={letterDetails.letterReviewers?.sort((a, b) => a.sequenceOrder - b.sequenceOrder) ?? []} locale={{emptyText: "No reviewers or approver assigned."}}
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
            {renderContent()}
             <Modal title="Reassign Review Step" open={isReassignModalVisible} onOk={handleReassignSubmit} onCancel={handleReassignCancel} confirmLoading={isActionLoading} okText="Reassign" cancelText="Cancel" okButtonProps={{ disabled: !reassignTargetUserId }}>
                 <Paragraph>Select the user to reassign this review step to. They will be notified. The reason/note should be entered in the main text area below the history.</Paragraph>
                 <Select showSearch placeholder="Select a user to reassign to" style={{ width: '100%', marginBottom: '10px' }} value={reassignTargetUserId} onChange={(value) => setReassignTargetUserId(value)} filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())} loading={reassignOptions.length === 0} >
                    {reassignOptions.map(user => ( <Option key={user.id} value={user.id} label={getUserFullName(user)}> <Space> <Avatar src={user.avatar} size="small">{getInitials(user)}</Avatar> {getUserFullName(user)} ({user.email}) </Space> </Option> ))}
                 </Select>
            </Modal>
        </div>
    );
}
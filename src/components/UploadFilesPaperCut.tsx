'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Spin, Table, Typography, Modal, message, Image as AntImage, Alert, Tooltip, Select, Space, List } from 'antd';
import type { TableProps } from 'antd';
import { Document, Page, pdfjs } from 'react-pdf';
import { v4 as uuidv4 } from 'uuid';
import Uppy, { UppyFile } from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import {
    ZoomInOutlined, ZoomOutOutlined, UndoOutlined,
    PlusOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

interface SignatureData { id: string; r2Url: string; name?: string; createdAt: string; }
interface StampData { id: string; r2Url: string; name?: string; createdAt: string; }
interface UnallocatedFile { id: string; name: string; url: string; size: number; mimetype: string; userId: string; isAllocated: boolean; createdAt: string; updatedAt: string; }
interface PlacedItem { id: string; type: 'signature' | 'stamp'; url: string; pageNumber: number; x: number; y: number; width: number; height: number; }
interface PlacingItemInfo { type: 'signature' | 'stamp'; url: string; width: number; height: number; }
interface PlacementInfoForBackend { type: 'signature' | 'stamp'; url: string; pageNumber: number; x: number; y: number; width: number; height: number; }
interface SaveSignedLetterPayload_Interactive { originalFileId: string; placements: PlacementInfoForBackend[]; reviewers?: string[]; approver?: string; }
interface SavedLetterResponse { id: string; letterUrl: string; }
type UppyMetaData = { storage: string; markAsUnallocated: boolean; };
type UppyBody = Record<string, unknown>;
interface UserOption { value: string; label: string; }

async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token_w') : null;
    const headers: HeadersInit = { 'Content-Type': 'application/json', };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const config: RequestInit = { method, headers, };
    if (body) { config.body = JSON.stringify(body); }
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}${endpoint}`, config);
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! status: ${response.status}` };
        try { errorData = await response.json(); } catch (e) { }
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) { return undefined as T; }
    return await response.json() as T;
}

const UploadAndSignPdf: React.FC = () => {
    const [unallocatedFiles, setUnallocatedFiles] = useState<UnallocatedFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
    const [selectedFileIds, setSelectedFileIds] = useState<React.Key[]>([]);
    const [signModalVisible, setSignModalVisible] = useState<boolean>(false);
    const [processingFile, setProcessingFile] = useState<UnallocatedFile | null>(null);
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([]);
    const [savedStamps, setSavedStamps] = useState<StampData[]>([]);
    const [isSavingLetter, setIsSavingLetter] = useState<boolean>(false);
    const uppyInstance = useRef<Uppy<UppyMetaData, UppyBody> | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
    const [placingItem, setPlacingItem] = useState<PlacingItemInfo | null>(null);
    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null);
    const [selectedStampUrl, setSelectedStampUrl] = useState<string | null>(null);
    const [approverOptions, setApproverOptions] = useState<UserOption[]>([]);
    const [selectedApprover, setSelectedApprover] = useState<string | null>(null);
    const [pdfScale, setPdfScale] = useState<number>(1.0);
    const ZOOM_STEP = 0.2;
    const MIN_SCALE = 0.4;
    const MAX_SCALE = 3.0;
    const [allReviewerOptions, setAllReviewerOptions] = useState<UserOption[]>([]);
    const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
    const [reviewerToAdd, setReviewerToAdd] = useState<string | null>(null);
    const [loadingReviewers, setLoadingReviewers] = useState<boolean>(false);
    const MAX_REVIEWERS = 5;

    const fetchUnallocatedFiles = useCallback(async () => {
        setLoadingFiles(true);
        try {
            const data = await apiRequest<UnallocatedFile[]>('/files/unallocated', 'GET');
            setUnallocatedFiles(data.filter(file => !file.isAllocated && file.url));
        } catch (error: any) {
            console.error('Error fetching unallocated files:', error);
            message.error(`Failed to load files: ${error.message}`);
            setUnallocatedFiles([]);
        } finally {
            setLoadingFiles(false);
        }
    }, []);

    const fetchAllReviewers = useCallback(async () => {
        setLoadingReviewers(true);
        try {
            const data = await apiRequest<UserOption[]>('/users/reviewers', 'GET');
            setAllReviewerOptions(data);
        } catch (error: any) {
            console.error('Error fetching reviewers:', error);
            message.error(`Failed to load reviewers: ${error.message}`);
            setAllReviewerOptions([]);
        } finally {
            setLoadingReviewers(false);
        }
    }, []);

    const fetchApprovers = useCallback(async () => {
        try {
            const data = await apiRequest<UserOption[]>('/users/approvers', 'GET');
            setApproverOptions(data);
        } catch (error: any) {
            console.error('Error fetching approvers:', error);
            message.error(`Failed to load approvers: ${error.message}`);
            setApproverOptions([]);
        }
    }, []);

    useEffect(() => {
         if (!uppyInstance.current && typeof window !== 'undefined') {
             const uppy = new Uppy<UppyMetaData, UppyBody>({
                 restrictions: { maxFileSize: 15 * 1024 * 1024, maxNumberOfFiles: 5, allowedFileTypes: ['application/pdf'], },
                 autoProceed: true,
                 meta: { storage: 'cloudflare_r2', markAsUnallocated: true, },
             }).use(XHRUpload, {
                 endpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/upload`,
                 formData: true,
                 fieldName: 'files',
                 bundle: false,
                 headers: () => {
                     const token = window.localStorage.getItem('access_token_w');
                     const headers: Record<string, string> = {};
                     if (token) { headers.Authorization = `Bearer ${token}`; }
                     return headers;
                 },
             });
             uppy.on('upload-success', (file, response) => { message.success(`"${file?.name || 'File'}" uploaded successfully.`); fetchUnallocatedFiles(); });
             uppy.on('upload-error', (file, error, response) => { console.error('Upload Error:', { file, error, response }); const backendMessage = response?.body?.message; message.error(`Upload failed for "${file?.name || 'file'}": ${backendMessage || error?.message || 'Unknown error'}`); });
             uppy.on('complete', (result) => { console.log('Upload complete:', result); });
             uppyInstance.current = uppy;
         }
         return () => {
             if (uppyInstance.current) { uppyInstance.current.cancelAll(); }
             uppyInstance.current = null;
         };
    }, [fetchUnallocatedFiles]);

    useEffect(() => {
        fetchUnallocatedFiles();
    }, [fetchUnallocatedFiles]);

    useEffect(() => {
         if (typeof window !== 'undefined') {
             try {
                 const sigsRaw = localStorage.getItem('signatures_r2');
                 const parsedSigs = sigsRaw ? JSON.parse(sigsRaw) : [];
                 if (Array.isArray(parsedSigs)) {
                     setSavedSignatures(parsedSigs.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt, })));
                 } else { setSavedSignatures([]); }
             } catch (e) { console.error("Failed to load/parse signatures from localStorage", e); setSavedSignatures([]); }
             try {
                 const stmpsRaw = localStorage.getItem('stamps_r2');
                 const parsedStamps = stmpsRaw ? JSON.parse(stmpsRaw) : [];
                 if (Array.isArray(parsedStamps)) {
                     setSavedStamps(parsedStamps.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt, })));
                 } else { setSavedStamps([]); }
             } catch (e) { console.error("Failed to load/parse stamps from localStorage", e); setSavedStamps([]); }
         }
    }, []);

    const handleFileSelectionChange = (selectedRowKeys: React.Key[]) => {
        setSelectedFileIds(selectedRowKeys);
    };

    const handleOpenSignModal = () => {
        if (selectedFileIds.length !== 1) {
            message.warning('Please select exactly one file to sign and stamp.');
            return;
        }
        const fileIdToProcess = selectedFileIds[0];
        const file = unallocatedFiles.find(f => f.id === fileIdToProcess);
        if (file && file.url) {
            setProcessingFile(file);
            setSignModalVisible(true);
            setPlacedItems([]);
            setPlacingItem(null);
            setSelectedSignatureUrl(null);
            setSelectedStampUrl(null);
            setNumPages(null);
            setPageNumber(1);
            setPdfLoadError(null);
            setPdfScale(1.0);
            setSelectedReviewers([]);
            setReviewerToAdd(null);
            setSelectedApprover(null);
            fetchAllReviewers();
            fetchApprovers();
        } else {
            message.error('Could not find selected file details or file URL is missing. Please refresh.');
            setSelectedFileIds([]);
        }
    };

    const handleCloseSignModal = () => {
        setSignModalVisible(false);
        setTimeout(() => {
            setProcessingFile(null);
            setPlacedItems([]);
            setPlacingItem(null);
            setSelectedSignatureUrl(null);
            setSelectedStampUrl(null);
            setNumPages(null);
            setPageNumber(1);
            setPdfLoadError(null);
            setPdfScale(1.0);
            setSelectedReviewers([]);
            setAllReviewerOptions([]);
            setReviewerToAdd(null);
            setApproverOptions([]);
            setSelectedApprover(null);
        }, 300);
    };

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

   const handlePdfAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!placingItem || !processingFile) return;
        const pdfWrapper = event.currentTarget;
        const rect = pdfWrapper.getBoundingClientRect();
        const clickX_viewport = event.clientX;
        const clickY_viewport = event.clientY;
        let relativeX = clickX_viewport - rect.left + pdfWrapper.scrollLeft;
        let relativeY = clickY_viewport - rect.top + pdfWrapper.scrollTop;
        const x_on_page = relativeX / pdfScale;
        const y_on_page = relativeY / pdfScale;
        let finalX = x_on_page - (placingItem.width / 2);
        let finalY = y_on_page - (placingItem.height / 2);
        console.group("Placement Calculation (Scaled)");
        console.log("Current Scale:", pdfScale);
        console.log("Click Coords (Viewport):", { x: clickX_viewport, y: clickY_viewport });
        console.log("Relative Coords (Adj for Scroll):", { x: relativeX, y: relativeY });
        console.log("Coords on Page (Adj for Scale):", { x: x_on_page, y: y_on_page });
        console.log("Final Item Top-Left (on Page):", { x: finalX, y: finalY });
        console.groupEnd();
        const newItem: PlacedItem = {
            id: uuidv4(),
            type: placingItem.type,
            url: placingItem.url,
            pageNumber: pageNumber,
            x: finalX,
            y: finalY,
            width: placingItem.width,
            height: placingItem.height,
        };
        setPlacedItems(prevItems => [...prevItems, newItem]);
        setPlacingItem(null);
   };

    const handleRemovePlacedItem = (itemId: string) => {
        setPlacedItems(prevItems => prevItems.filter(item => item.id !== itemId));
    };

    const handleApproverChange = (value: string | null) => {
        setSelectedApprover(value);
    };

    const handleSaveSignedLetter = async () => {
        if (!processingFile) {
            message.error('No file is being processed.');
            return;
        }
        const hasSignature = placedItems.some(item => item.type === 'signature');
        const hasStamp = placedItems.some(item => item.type === 'stamp');
        if (!hasSignature || !hasStamp) {
            message.warning('Please place at least one signature and one stamp on the document.');
            return;
        }
        // --- ADDED VALIDATION: Ensure at least one reviewer is selected ---
        if (!selectedReviewers || selectedReviewers.length === 0) {
            message.warning('Please select at least one reviewer before saving.');
            return;
        }

        setIsSavingLetter(true);
        const placementsForBackend: PlacementInfoForBackend[] = placedItems.map(item => ({
            type: item.type,
            url: item.url,
            pageNumber: item.pageNumber,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
        }));

        // --- MODIFIED Payload ---
        const payload: SaveSignedLetterPayload_Interactive = {
            originalFileId: processingFile.id,
            placements: placementsForBackend,
            reviewers: selectedReviewers, // Include the ordered list of reviewer IDs
            approver: selectedApprover ?? undefined, // Include the selected approver ID (or undefined if null)
            // name: processingFile.name // Optional: You could explicitly set a name here if needed by backend
        };
        // --- End MODIFIED Payload ---

        try {
            console.log("Sending payload to /letters/from-pdf-interactive:", payload); // Log the payload being sent
            const savedLetter = await apiRequest<SavedLetterResponse>('/letters/from-pdf-interactive', 'POST', payload);
            message.success(`Letter created successfully (ID: ${savedLetter.id})`);
            handleCloseSignModal();
            setSelectedFileIds([]);
            fetchUnallocatedFiles();
        } catch (error: any) {
            console.error('Error saving signed letter:', error);
            message.error(`Failed to save letter: ${error.message}`);
        } finally {
            setIsSavingLetter(false);
        }
    };
    const handleAddReviewer = () => {
        if (!reviewerToAdd) {
            message.warning('Please select a reviewer to add.');
            return;
        }
        if (selectedReviewers.includes(reviewerToAdd)) {
            message.warning('This reviewer has already been added.');
            setReviewerToAdd(null);
            return;
        }
        if (selectedReviewers.length >= MAX_REVIEWERS) {
            message.warning(`You can only add up to ${MAX_REVIEWERS} reviewers.`);
            return;
        }
        setSelectedReviewers(prev => [...prev, reviewerToAdd]);
        setReviewerToAdd(null);
    };

    const handleRemoveReviewer = (indexToRemove: number) => {
        setSelectedReviewers(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleMoveReviewer = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === selectedReviewers.length - 1) return;

        const newOrderedList = [...selectedReviewers];
        const itemToMove = newOrderedList[index];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        newOrderedList[index] = newOrderedList[swapIndex];
        newOrderedList[swapIndex] = itemToMove;

        setSelectedReviewers(newOrderedList);
    };

    const handleZoomIn = () => {
        setPdfScale(prevScale => Math.min(prevScale + ZOOM_STEP, MAX_SCALE));
    };

    const handleZoomOut = () => {
        setPdfScale(prevScale => Math.max(prevScale - ZOOM_STEP, MIN_SCALE));
    };

    const handleResetZoom = () => {
        setPdfScale(1.0);
    };

    const availableReviewerOptions = allReviewerOptions.filter(
        option => !selectedReviewers.includes(option.value)
    );

    const getReviewerLabel = (id: string): string => {
        return allReviewerOptions.find(opt => opt.value === id)?.label || 'Unknown Reviewer';
    };


    const fileColumns: TableProps<UnallocatedFile>['columns'] = [
        { title: 'File Name', dataIndex: 'name', key: 'name', ellipsis: true, render: (name) => <Typography.Text title={name}>{name}</Typography.Text>, },
        { title: 'Size', dataIndex: 'size', key: 'size', width: 100, render: (size) => size ? `${Math.round(size / 1024)} KB` : '-', },
        { title: 'Type', dataIndex: 'mimetype', key: 'mimetype', width: 130, render: (type) => type || '-', },
        { title: 'Upload Date', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (date) => date ? new Date(date).toLocaleString() : '-', },
    ];

    const rowSelection = {
        selectedRowKeys: selectedFileIds,
        onChange: handleFileSelectionChange,
        type: 'checkbox' as const,
    };

    const canSaveChanges = placedItems.some(item => item.type === 'signature') && placedItems.some(item => item.type === 'stamp');

    return (
        <div className="space-y-6">
            <Card title="1. Upload PDF Files">
                {typeof window !== 'undefined' && uppyInstance.current ? (
                    <Dashboard uppy={uppyInstance.current} proudlyDisplayPoweredByUppy={false} height={250} width="100%" showLinkToFileUploadResult={false} note="Drag & drop PDF files or click to browse. Max 15MB each." theme="light" />
                ) : (
                    <div className="text-center p-10"><Spin tip="Loading uploader..." /></div>
                )}
            </Card>

            <Card title="2. Select File and Add Signature/Stamp" actions={[<Button key="refresh" type="text" onClick={fetchUnallocatedFiles} icon={<i className="fas fa-sync-alt"></i>} />]}>
                 <div className="mb-4 space-x-4">
                     <Button type="primary" onClick={handleOpenSignModal} disabled={selectedFileIds.length !== 1 || loadingFiles} >
                         Sign & Stamp Selected File
                     </Button>
                     <Typography.Text type="secondary">
                         {selectedFileIds.length === 0 ? 'Select one file below to enable signing.' : selectedFileIds.length === 1 ? `1 file selected.` : `${selectedFileIds.length} files selected. Please select only one.`}
                     </Typography.Text>
                 </div>
                 <Table<UnallocatedFile>
                    rowKey="id"
                    dataSource={unallocatedFiles}
                    columns={fileColumns}
                    loading={loadingFiles}
                    rowSelection={rowSelection}
                    pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
                    scroll={{ y: 350 }}
                    size="middle"
                 />
            </Card>

            <Modal
                title={<Typography.Text ellipsis={{ tooltip: processingFile?.name }}> Sign & Stamp: {processingFile?.name || 'File'} </Typography.Text>}
                open={signModalVisible}
                onCancel={handleCloseSignModal}
                width={1000}
                destroyOnClose
                footer={[
                    <Button key="back" onClick={handleCloseSignModal} disabled={isSavingLetter}> Cancel </Button>,
                    <Button key="submit" type="primary" loading={isSavingLetter} onClick={handleSaveSignedLetter} disabled={!canSaveChanges} > Save Signed Letter </Button>,
                ]}
            >
                <div className="flex flex-col md:flex-row gap-4 p-1 max-h-[75vh] overflow-hidden">

                    <div className="flex-1 flex flex-col border border-gray-300 rounded-md overflow-hidden bg-gray-100">
                        <div className="flex justify-between items-center p-2 bg-gray-200 border-b border-gray-300 sticky top-0 z-10">
                            <div>
                                {numPages && numPages > 1 && (
                                    <Space>
                                        <Button onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))} disabled={pageNumber <= 1 || !numPages} size="small"> Previous </Button>
                                        <span> Page {pageNumber} of {numPages} </span>
                                        <Button onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))} disabled={pageNumber >= (numPages ?? 0) || !numPages} size="small"> Next </Button>
                                    </Space>
                                )}
                                {!numPages && pdfLoadError && <span className='text-red-500 text-xs'>Page info unavailable</span>}
                                {!numPages && !pdfLoadError && processingFile?.url && <span className='text-gray-500 text-xs'>Loading page info...</span>}
                            </div>

                            <Space>
                                <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= MIN_SCALE || !numPages} size="small" />
                                <Tooltip title="Reset Zoom">
                                    <Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1.0 || !numPages} size="small" />
                                </Tooltip>
                                <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= MAX_SCALE || !numPages} size="small" />
                                <span className="text-sm font-semibold w-12 text-center">
                                    {Math.round(pdfScale * 100)}%
                                </span>
                            </Space>
                        </div>

                        <div
                            className="flex-1 overflow-auto p-2 relative"
                            onClick={handlePdfAreaClick}
                            style={{ cursor: placingItem ? 'copy' : 'default' }}
                        >
                            {processingFile?.url ? (
                                <>
                                    {pdfLoadError && (
                                        <Alert message="Error loading PDF" description={pdfLoadError} type="error" showIcon className="m-4" />
                                    )}
                                    <Document
                                        file={processingFile.url}
                                        onLoadSuccess={({ numPages: totalPages }) => {
                                            setNumPages(totalPages);
                                            setPageNumber(1);
                                            setPdfLoadError(null);
                                            setPdfScale(1.0);
                                        }}
                                        onLoadError={(error) => {
                                            console.error("Error loading PDF:", error);
                                            setPdfLoadError(`Failed to load PDF: ${error.message}. Check console and ensure URL is valid and accessible.`);
                                            setNumPages(null);
                                        }}
                                        loading={<div className="text-center p-10"><Spin tip="Loading PDF..." /></div>}
                                        error={<div className="text-center p-10 text-red-500">Failed to load PDF document.</div>}
                                        className="flex justify-center items-start"
                                    >
                                        <Page
                                            key={`page_${pageNumber}`}
                                            pageNumber={pageNumber}
                                            scale={pdfScale}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                            className="shadow-lg"
                                            loading={<div style={{ height: '500px' }}><Spin /></div>}
                                            error={<div className="text-red-500">Failed to render page.</div>}
                                        />
                                        {placedItems
                                            .filter(item => item.pageNumber === pageNumber)
                                            .map(item => (
                                                <Tooltip key={item.id} title="Click to remove">
                                                    <img
                                                        src={item.url}
                                                        alt={item.type}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${item.x * pdfScale}px`,
                                                            top: `${item.y * pdfScale}px`,
                                                            width: `${item.width * pdfScale}px`,
                                                            height: `${item.height * pdfScale}px`,
                                                            cursor: 'pointer',
                                                            border: '1px dashed rgba(128, 128, 128, 0.7)',
                                                            objectFit: 'contain',
                                                            userSelect: 'none',
                                                            transformOrigin: 'top left',
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemovePlacedItem(item.id);
                                                        }}
                                                    />
                                                </Tooltip>
                                            ))}
                                    </Document>
                                </>
                            ) : (
                                <div className="text-center p-10"><Typography.Text type="secondary">No PDF file selected or URL missing.</Typography.Text></div>
                            )}
                        </div>
                    </div>


                    <div className="w-full md:w-1/3 space-y-4 p-2 overflow-y-auto">
                        {placingItem && (
                            <Alert message={`Click on the PDF to place the selected ${placingItem.type}.`} type="info" showIcon closable onClose={() => setPlacingItem(null)} />
                        )}
                         {!placingItem && placedItems.length > 0 && (
                            <Alert message="Click on a placed item (signature/stamp) on the PDF to remove it." type="info" showIcon />
                        )}

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
                            {savedStamps.length === 0 ? (<Typography.Text type="secondary">No stamps saved...</Typography.Text>) : (
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
                                <Typography.Title level={5} style={{ marginBottom: '8px' }}>Placed Items</Typography.Title>
                                <List
                                    size="small"
                                    bordered
                                    dataSource={placedItems}
                                    renderItem={item => (
                                        <List.Item
                                            actions={[<Button type="link" danger size="small" onClick={() => handleRemovePlacedItem(item.id)}>Remove</Button>]}
                                        >
                                            <List.Item.Meta
                                                title={`${item.type.charAt(0).toUpperCase() + item.type.slice(1)} on page ${item.pageNumber}`}
                                            />
                                        </List.Item>
                                    )}
                                />
                            </div>
                         )}

                        <div>
                            <Typography.Title level={5} style={{ marginBottom: '8px' }}>
                                Add Reviewers (Order Matters)
                            </Typography.Title>
                            <Space.Compact style={{ width: '100%' }}>
                                <Select
                                    style={{ width: '100%' }}
                                    placeholder="Find reviewer to add..."
                                    showSearch
                                    allowClear
                                    value={reviewerToAdd}
                                    onChange={(value) => setReviewerToAdd(value)}
                                    options={availableReviewerOptions}
                                    loading={loadingReviewers}
                                    filterOption={(input, option) =>
                                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    disabled={selectedReviewers.length >= MAX_REVIEWERS}
                                />
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleAddReviewer}
                                    disabled={!reviewerToAdd || selectedReviewers.length >= MAX_REVIEWERS}
                                />
                            </Space.Compact>

                            {selectedReviewers.length >= MAX_REVIEWERS && !reviewerToAdd &&(
                                <Typography.Text type="warning" className="text-xs block mt-1">
                                    Maximum {MAX_REVIEWERS} reviewers reached.
                                </Typography.Text>
                            )}

                            {selectedReviewers.length > 0 && (
                                <List
                                    size="small"
                                    header={<Typography.Text strong>Review Order:</Typography.Text>}
                                    bordered
                                    dataSource={selectedReviewers}
                                    renderItem={(reviewerId, index) => (
                                        <List.Item
                                            actions={[
                                                <Tooltip title="Move Up">
                                                    <Button
                                                        shape="circle"
                                                        icon={<ArrowUpOutlined />}
                                                        size="small"
                                                        onClick={() => handleMoveReviewer(index, 'up')}
                                                        disabled={index === 0}
                                                    />
                                                </Tooltip>,
                                                <Tooltip title="Move Down">
                                                    <Button
                                                        shape="circle"
                                                        icon={<ArrowDownOutlined />}
                                                        size="small"
                                                        onClick={() => handleMoveReviewer(index, 'down')}
                                                        disabled={index === selectedReviewers.length - 1}
                                                    />
                                                </Tooltip>,
                                                 <Tooltip title="Remove">
                                                    <Button
                                                        danger
                                                        shape="circle"
                                                        icon={<DeleteOutlined />}
                                                        size="small"
                                                        onClick={() => handleRemoveReviewer(index)}
                                                    />
                                                </Tooltip>
                                            ]}
                                        >
                                            <List.Item.Meta
                                                title={`${index + 1}. ${getReviewerLabel(reviewerId)}`}
                                            />
                                        </List.Item>
                                    )}
                                    className="mt-3"
                                />
                            )}
                        </div>

                        <div>
                            <Typography.Title level={5} style={{ marginBottom: '8px' }}>Add Approver</Typography.Title>
                            <Select
                                style={{ width: '100%' }}
                                placeholder="Select Approver"
                                value={selectedApprover}
                                onChange={handleApproverChange}
                                options={approverOptions}
                                allowClear
                                showSearch
                                filterOption={(input, option) =>
                                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                        </div>

                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UploadAndSignPdf;
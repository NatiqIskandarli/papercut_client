// src/components/UploadAndSignPdf.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Card,
    Button,
    Spin,
    Table,
    Typography,
    Modal,
    message,
    Image as AntImage,
    Alert,
    Tooltip // Tooltip əlavə edildi (optional)
} from 'antd';
import type { TableProps } from 'antd';
import { Document, Page, pdfjs } from 'react-pdf';
import { v4 as uuidv4 } from 'uuid'; // UUID import edildi

// Uppy Core and React component
import Uppy, { UppyFile } from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';

// CSS Imports
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Worker setup (Ensure the path is correct and the file exists in public/lib/pdfjs)
pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`; // Və ya .js uzantısı

// --- Interfaces ---

interface SignatureData {
    id: string;
    r2Url: string;
    name?: string;
    createdAt: string;
}

interface StampData {
    id: string;
    r2Url: string;
    name?: string;
    createdAt: string;
}

interface UnallocatedFile {
    id: string;
    name: string;
    url: string; // This should be the accessible signed URL from backend
    size: number;
    mimetype: string;
    userId: string;
    isAllocated: boolean;
    createdAt: string;
    updatedAt: string;
}

// --- NEW: Interfaces for placement ---
interface PlacedItem {
    id: string; // Unique ID for each placed item
    type: 'signature' | 'stamp';
    url: string;
    pageNumber: number;
    x: number; // Left position relative to PDF container (%) could be better? Let's use px for now
    y: number; // Top position relative to PDF container (%)
    width: number; // Display width of the placed item (px)
    height: number; // Display height of the placed item (px)
}

interface PlacingItemInfo {
    type: 'signature' | 'stamp';
    url: string;
    width: number; // Default width for placing
    height: number; // Default height for placing
}

// --- NEW: Payload for the updated API endpoint ---
interface PlacementInfoForBackend {
    type: 'signature' | 'stamp';
    url: string;
    pageNumber: number;
    x: number; // Consider sending relative coordinates (e.g., %) to backend if PDF size varies
    y: number;
    width: number;
    height: number;
}
interface SaveSignedLetterPayload_Interactive {
    originalFileId: string;
    // originalFileUrl might not be needed if backend uses ID
    placements: PlacementInfoForBackend[];
}

// Expected response structure (remains the same for now)
interface SavedLetterResponse {
    id: string;
    letterUrl: string;
}

// --- Uppy Specific Types (remain the same) ---
type UppyMetaData = { storage: string; markAsUnallocated: boolean; };
type UppyBody = Record<string, unknown>;

// --- API Helper (remains the same) ---
async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> { const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token_w') : null; const headers: HeadersInit = { 'Content-Type': 'application/json', }; if (token) { headers['Authorization'] = `Bearer ${token}`; } const config: RequestInit = { method, headers, }; if (body) { config.body = JSON.stringify(body); } const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}${endpoint}`, config); if (!response.ok) { let errorData: any = { message: `HTTP error! status: ${response.status}` }; try { errorData = await response.json(); } catch (e) { } throw new Error(errorData?.message || `HTTP error! status: ${response.status}`); } if (response.status === 204) { return undefined as T; } return await response.json() as T; }


// --- Main Component ---
const UploadAndSignPdf: React.FC = () => {
    // --- State Declarations ---
    const [unallocatedFiles, setUnallocatedFiles] = useState<UnallocatedFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
    const [selectedFileIds, setSelectedFileIds] = useState<React.Key[]>([]);
    const [signModalVisible, setSignModalVisible] = useState<boolean>(false);
    const [processingFile, setProcessingFile] = useState<UnallocatedFile | null>(null);
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([]);
    const [savedStamps, setSavedStamps] = useState<StampData[]>([]);
    const [isSavingLetter, setIsSavingLetter] = useState<boolean>(false);
    const uppyInstance = useRef<Uppy<UppyMetaData, UppyBody> | null>(null);

    // PDF Display State
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

    // --- NEW: Placement State ---
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
    const [placingItem, setPlacingItem] = useState<PlacingItemInfo | null>(null);
    // Keep track of selection for UI feedback, not for saving logic
    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null);
    const [selectedStampUrl, setSelectedStampUrl] = useState<string | null>(null);


    // --- Fetch Unallocated Files (remains the same) ---
    const fetchUnallocatedFiles = useCallback(async () => {
        setLoadingFiles(true);
        try {
            const data = await apiRequest<UnallocatedFile[]>('/files/unallocated', 'GET');
            // Ensure URL exists - IMPORTANT: backend must provide accessible URLs
            setUnallocatedFiles(data.filter(file => !file.isAllocated && file.url));
        } catch (error: any) {
            console.error('Error fetching unallocated files:', error);
            message.error(`Failed to load files: ${error.message}`);
            setUnallocatedFiles([]);
        } finally {
            setLoadingFiles(false);
        }
    }, []);

    // --- Uppy Initialization (remains the same) ---
    useEffect(() => {
        // ... (Uppy setup code - no changes needed here) ...
         if (!uppyInstance.current && typeof window !== 'undefined') { const uppy = new Uppy<UppyMetaData, UppyBody>({ restrictions: { maxFileSize: 15 * 1024 * 1024, maxNumberOfFiles: 5, allowedFileTypes: ['application/pdf'], }, autoProceed: true, meta: { storage: 'cloudflare_r2', markAsUnallocated: true, }, }).use(XHRUpload, { endpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/upload`, formData: true, fieldName: 'files', bundle: false, headers: () => { const token = window.localStorage.getItem('access_token_w'); const headers: Record<string, string> = {}; if (token) { headers.Authorization = `Bearer ${token}`; } return headers; }, }); uppy.on('upload-success', (file, response) => { message.success(`"${file?.name || 'File'}" uploaded successfully.`); fetchUnallocatedFiles(); }); uppy.on('upload-error', (file, error, response) => { console.error('Upload Error:', { file, error, response }); const backendMessage = response?.body?.message; message.error(`Upload failed for "${file?.name || 'file'}": ${backendMessage || error?.message || 'Unknown error'}`); }); uppy.on('complete', (result) => { console.log('Upload complete:', result); }); uppyInstance.current = uppy; } return () => { if (uppyInstance.current) { uppyInstance.current.cancelAll(); } uppyInstance.current = null; };
    }, [fetchUnallocatedFiles]);

    // Fetch files on mount (remains the same)
    useEffect(() => {
        fetchUnallocatedFiles();
    }, [fetchUnallocatedFiles]);

    // Load Signatures & Stamps (remains the same)
    useEffect(() => {
        // ... (localStorage loading code - no changes needed here) ...
         if (typeof window !== 'undefined') { try { const sigsRaw = localStorage.getItem('signatures_r2'); const parsedSigs = sigsRaw ? JSON.parse(sigsRaw) : []; if (Array.isArray(parsedSigs)) { setSavedSignatures(parsedSigs.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt, }))); } else { setSavedSignatures([]); } } catch (e) { console.error("Failed to load/parse signatures from localStorage", e); setSavedSignatures([]); } try { const stmpsRaw = localStorage.getItem('stamps_r2'); const parsedStamps = stmpsRaw ? JSON.parse(stmpsRaw) : []; if (Array.isArray(parsedStamps)) { setSavedStamps(parsedStamps.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt, }))); } else { setSavedStamps([]); } } catch (e) { console.error("Failed to load/parse stamps from localStorage", e); setSavedStamps([]); } }
    }, []);

    // --- Event Handlers ---
    const handleFileSelectionChange = (selectedRowKeys: React.Key[]) => {
        setSelectedFileIds(selectedRowKeys);
    };

    // Reset state when opening modal
    const handleOpenSignModal = () => {
        if (selectedFileIds.length !== 1) {
            message.warning('Please select exactly one file to sign and stamp.');
            return;
        }
        const fileIdToProcess = selectedFileIds[0];
        const file = unallocatedFiles.find(f => f.id === fileIdToProcess);

        if (file && file.url) { // Ensure URL is present
            setProcessingFile(file);
            setSignModalVisible(true);
            // Reset placement state for the new file
            setPlacedItems([]);
            setPlacingItem(null);
            setSelectedSignatureUrl(null);
            setSelectedStampUrl(null);
            setNumPages(null);
            setPageNumber(1);
            setPdfLoadError(null);
        } else {
            message.error('Could not find selected file details or file URL is missing. Please refresh.');
            setSelectedFileIds([]);
        }
    };

    // Reset state on modal close
    const handleCloseSignModal = () => {
        setSignModalVisible(false);
        // Delay reset to allow modal animation to finish
        setTimeout(() => {
            setProcessingFile(null);
            setPlacedItems([]);
            setPlacingItem(null);
            setSelectedSignatureUrl(null);
            setSelectedStampUrl(null);
            setNumPages(null);
            setPageNumber(1);
            setPdfLoadError(null);
        }, 300);
    };

    // --- NEW: Handlers for selecting items to place ---
    const handleSelectSignatureForPlacing = (sig: SignatureData) => {
        setPlacingItem({ type: 'signature', url: sig.r2Url, width: 100, height: 40 });
        setSelectedSignatureUrl(sig.r2Url); // Keep UI feedback
        setSelectedStampUrl(null);
    };

    const handleSelectStampForPlacing = (stamp: StampData) => {
        setPlacingItem({ type: 'stamp', url: stamp.r2Url, width: 60, height: 60 });
        setSelectedStampUrl(stamp.r2Url); // Keep UI feedback
        setSelectedSignatureUrl(null);
    };

    // --- NEW: Handler for clicking on PDF area to place item ---
   // --- UPDATED: Handler for clicking on PDF area to place item ---
   const handlePdfAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!placingItem || !processingFile) return; // Element seçilməyibsə, heç nə etmə

    const pdfWrapper = event.currentTarget; // onClick handlerinin bağlı olduğu div (position: relative olan)
    const rect = pdfWrapper.getBoundingClientRect(); // Div-in viewport-a nəzərən ölçü və mövqeyi

    // Klikin viewport-a nəzərən xam koordinatları
    const clickX_viewport = event.clientX;
    const clickY_viewport = event.clientY;

    // Klikin div-in yuxarı sol küncünə nəzərən ilkin nisbi koordinatları
    let relativeX = clickX_viewport - rect.left;
    let relativeY = clickY_viewport - rect.top;

    // === ƏSAS DƏYİŞİKLİK: Scroll vəziyyətini əlavə et ===
    // Div-in daxilində nə qədər üfüqi və şaquli scroll edildiyini nəzərə alırıq
    relativeX += pdfWrapper.scrollLeft;
    relativeY += pdfWrapper.scrollTop;
    // ====================================================

    // Elementi kliklənən nöqtəyə mərkəzləşdirmək üçün ölçünün yarısını çıxırıq
    // (Bu addım dəqiq olmaya bilər, çünki şəklin ölçüsü fərqli ola bilər,
    // amma başlanğıc üçün yaxşıdır)
    let finalX = relativeX - placingItem.width / 2;
    let finalY = relativeY - placingItem.height / 2;

    // Elementin div sərhədlərindən kənara çıxmamasını təmin etmək (optional)
    // Sərhəd yoxlamasını scroll edilmiş məzmuna görə edirik
    const maxVisibleX = pdfWrapper.scrollWidth - placingItem.width;
    const maxVisibleY = pdfWrapper.scrollHeight - placingItem.height;
    finalX = Math.max(0, Math.min(finalX, maxVisibleX));
    finalY = Math.max(0, Math.min(finalY, maxVisibleY));


    // --- Diaqnostika üçün Loglar ---
    console.group("Placement Calculation"); // Logları qruplaşdır
    console.log("Placing Item:", placingItem);
    console.log("Click Coords (Viewport):", { x: clickX_viewport, y: clickY_viewport });
    console.log("Wrapper Rect (Viewport):", { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    console.log("Wrapper Scroll:", { top: pdfWrapper.scrollTop, left: pdfWrapper.scrollLeft });
    console.log("Wrapper Scroll Dims:", { width: pdfWrapper.scrollWidth, height: pdfWrapper.scrollHeight });
    console.log("Relative Coords (Initial - Before Scroll Adj):", { x: clickX_viewport - rect.left, y: clickY_viewport - rect.top });
    console.log("Relative Coords (Final - After Scroll Adj):", { x: relativeX, y: relativeY });
    console.log("Final Coords (Centered & Bounded):", { x: finalX, y: finalY });
    console.groupEnd();
    // --- Logların Sonu ---


    const newItem: PlacedItem = {
        id: uuidv4(),
        type: placingItem.type,
        url: placingItem.url,
        pageNumber: pageNumber, // Hazırkı səhifə nömrəsi
        x: finalX, // Düzəliş edilmiş koordinatları istifadə et
        y: finalY, // Düzəliş edilmiş koordinatları istifadə et
        width: placingItem.width,
        height: placingItem.height,
    };

    setPlacedItems(prevItems => [...prevItems, newItem]);
    setPlacingItem(null); // Yerləşdirmə rejimini sıfırla
};

     // --- NEW: Handler to remove a placed item ---
     const handleRemovePlacedItem = (itemId: string) => {
        setPlacedItems(prevItems => prevItems.filter(item => item.id !== itemId));
    };

    // --- UPDATED: Save handler to send placement data ---
    const handleSaveSignedLetter = async () => {
        if (!processingFile) {
            message.error('No file is being processed.');
            return;
        }

        // Check if at least one signature and one stamp are placed
        const hasSignature = placedItems.some(item => item.type === 'signature');
        const hasStamp = placedItems.some(item => item.type === 'stamp');

        if (!hasSignature || !hasStamp) {
            message.warning('Please place at least one signature and one stamp on the document.');
            return;
        }

        setIsSavingLetter(true);

        // Prepare placement data for backend
        // IMPORTANT: Convert coordinates if necessary (e.g., to relative %, or based on original PDF size)
        // For now, sending raw pixel coordinates relative to the container. Backend needs to handle this.
        const placementsForBackend: PlacementInfoForBackend[] = placedItems.map(item => ({
            type: item.type,
            url: item.url,
            pageNumber: item.pageNumber,
            x: item.x, // Frontend pixels - Backend needs context (page size, render size)
            y: item.y, // Frontend pixels - Backend needs context (page size, render size)
            width: item.width, // Frontend pixels
            height: item.height, // Frontend pixels
        }));

        const payload: SaveSignedLetterPayload_Interactive = {
            originalFileId: processingFile.id,
            placements: placementsForBackend,
        };

        try {
            console.log("Sending payload to /letters/from-pdf-interactive:", payload);
            // IMPORTANT: Use a NEW or UPDATED backend endpoint that expects the 'placements' array
            const savedLetter = await apiRequest<SavedLetterResponse>('/letters/from-pdf-interactive', 'POST', payload);
            message.success(`Letter created successfully (ID: ${savedLetter.id})`);
            handleCloseSignModal();
            setSelectedFileIds([]); // Deselect file in the table
            fetchUnallocatedFiles(); // Refresh the list
        } catch (error: any) {
            console.error('Error saving signed letter:', error);
            message.error(`Failed to save letter: ${error.message}`);
        } finally {
            setIsSavingLetter(false);
        }
    };


    // --- Table Columns Definition (remains the same) ---
    const fileColumns: TableProps<UnallocatedFile>['columns'] = [{ title: 'File Name', dataIndex: 'name', key: 'name', ellipsis: true, render: (name) => <Typography.Text title={name}>{name}</Typography.Text>, }, { title: 'Size', dataIndex: 'size', key: 'size', width: 100, render: (size) => size ? `${Math.round(size / 1024)} KB` : '-', }, { title: 'Type', dataIndex: 'mimetype', key: 'mimetype', width: 130, render: (type) => type || '-', }, { title: 'Upload Date', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (date) => date ? new Date(date).toLocaleString() : '-', },];

    // --- Row Selection Config (remains the same) ---
    const rowSelection = { selectedRowKeys: selectedFileIds, onChange: handleFileSelectionChange, type: 'checkbox' as const, };

    // --- Calculate if save should be enabled ---
    const canSaveChanges = placedItems.some(item => item.type === 'signature') && placedItems.some(item => item.type === 'stamp');


    // --- Render ---
    return (
        <div className="space-y-6">
            {/* Card 1: File Upload (remains the same) */}
            <Card title="1. Upload PDF Files">
                {typeof window !== 'undefined' && uppyInstance.current ? (
                    <Dashboard uppy={uppyInstance.current} proudlyDisplayPoweredByUppy={false} height={250} width="100%" showLinkToFileUploadResult={false} note="Drag & drop PDF files or click to browse. Max 15MB each." theme="light" />
                ) : (
                    <div className="text-center p-10"><Spin tip="Loading uploader..." /></div>
                )}
            </Card>

            {/* Card 2: Unallocated Files & Action Button (remains the same) */}
            <Card title="2. Select File and Add Signature/Stamp">
                 <div className="mb-4 space-x-4"> <Button type="primary" onClick={handleOpenSignModal} disabled={selectedFileIds.length !== 1 || loadingFiles} > Sign & Stamp Selected File </Button> <Typography.Text type="secondary"> {selectedFileIds.length === 0 ? 'Select one file below to enable signing.' : selectedFileIds.length === 1 ? `1 file selected.` : `${selectedFileIds.length} files selected. Please select only one.`} </Typography.Text> </div>
                 <Table<UnallocatedFile> rowKey="id" dataSource={unallocatedFiles} columns={fileColumns} loading={loadingFiles} rowSelection={rowSelection} pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }} scroll={{ y: 350 }} size="middle" />
            </Card>

            {/* Modal for Signing and Stamping */}
            <Modal
                title={<Typography.Text ellipsis={{ tooltip: processingFile?.name }}> Sign & Stamp: {processingFile?.name || 'File'} </Typography.Text>}
                open={signModalVisible}
                onCancel={handleCloseSignModal}
                width={1000} // Increased width for better layout
                destroyOnClose
                footer={[
                    <Button key="back" onClick={handleCloseSignModal} disabled={isSavingLetter}> Cancel </Button>,
                    // UPDATED Save Button Condition
                    <Button key="submit" type="primary" loading={isSavingLetter} onClick={handleSaveSignedLetter} disabled={!canSaveChanges} > Save Signed Letter </Button>,
                ]}
                // Centered modal might be better
                // centered
            >
                {/* Split modal content */}
                <div className="flex flex-col md:flex-row gap-4 p-1 max-h-[75vh] overflow-hidden">

                    {/* Left Side: PDF Display Area */}
                    <div
                        className="flex-1 border border-gray-300 rounded-md overflow-auto bg-gray-100 p-2 relative"
                        onClick={handlePdfAreaClick} // Add click handler here
                        style={{ cursor: placingItem ? 'copy' : 'default' }} // Change cursor when placing
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
                                    }}
                                    onLoadError={(error) => {
                                        console.error("Error loading PDF:", error);
                                        setPdfLoadError(`Failed to load PDF: ${error.message}. Check console and ensure URL is valid.`);
                                        setNumPages(null);
                                    }}
                                    loading={<div className="text-center p-10"><Spin tip="Loading PDF..." /></div>}
                                    error={<div className="text-center p-10 text-red-500">Failed to load PDF document.</div>}
                                >
                                    {/* Render Page */}
                                    <Page
                                        key={`page_${pageNumber}`}
                                        pageNumber={pageNumber}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                    // Adjust width/scale if needed for consistent sizing
                                    />

                                    {/* NEW: Render Placed Items on top */}
                                    {placedItems
                                        .filter(item => item.pageNumber === pageNumber) // Only show items for the current page
                                        .map(item => (
                                            <Tooltip key={item.id} title="Click to remove">
                                                <img
                                                    src={item.url}
                                                    alt={item.type}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${item.x}px`,
                                                        top: `${item.y}px`,
                                                        width: `${item.width}px`,
                                                        height: `${item.height}px`,
                                                        cursor: 'pointer',
                                                        border: '1px dashed rgba(128, 128, 128, 0.7)', // Visual aid
                                                        objectFit: 'contain', // Ensure aspect ratio is maintained
                                                        userSelect: 'none' // Prevent image selection/drag
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent PDF area click when clicking the item
                                                        handleRemovePlacedItem(item.id);
                                                    }}
                                                />
                                            </Tooltip>
                                        ))}
                                </Document>

                                {/* Pagination Controls */}
                                {numPages && numPages > 1 && (
                                    <div className="text-center mt-2 p-2 bg-gray-200 rounded-b-md sticky bottom-0 z-10">
                                        <Button onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))} disabled={pageNumber <= 1} size="small" className="mr-2"> Previous </Button>
                                        <span> Page {pageNumber} of {numPages} </span>
                                        <Button onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))} disabled={pageNumber >= numPages} size="small" className="ml-2"> Next </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center p-10"><Typography.Text type="secondary">No PDF file selected or URL missing.</Typography.Text></div>
                        )}
                    </div> {/* End PDF Display Area */}

                    {/* Right Side: Signature and Stamp Selection Area */}
                    <div className="w-full md:w-1/3 space-y-4 p-2 overflow-y-auto">
                        {placingItem && (
                            <Alert message={`Click on the PDF to place the selected ${placingItem.type}.`} type="info" showIcon closable onClose={() => setPlacingItem(null)} />
                        )}
                         {!placingItem && placedItems.length > 0 && (
                            <Alert message="Click on a placed item to remove it." type="info" showIcon />
                        )}
                        <div>
                            <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Signature</Typography.Title>
                            {savedSignatures.length === 0 ? (<Typography.Text type="secondary">No signatures...</Typography.Text>) : (
                                <div className="flex flex-wrap gap-2">
                                    {savedSignatures.map(sig => (
                                        <button
                                            key={sig.id}
                                            type="button"
                                            // UPDATED onClick
                                            onClick={() => handleSelectSignatureForPlacing(sig)}
                                            className={`p-1 border rounded-md transition-all ${selectedSignatureUrl === sig.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                            title={sig.name || `Signature`}
                                        >
                                            <AntImage src={sig.r2Url} alt={sig.name || 'Signature'} width={80} height={35} preview={false} className="object-contain" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {/* Optional: Show warning if needed, though save button handles logic now */}
                            {/* {!placedItems.some(i => i.type === 'signature') && savedSignatures.length > 0 && <Typography.Text type="warning" className="text-xs block mt-1">Please place a signature.</Typography.Text>} */}
                        </div>
                        <div>
                            <Typography.Title level={5} style={{ marginBottom: '8px' }}>Select Stamp</Typography.Title>
                            {savedStamps.length === 0 ? (<Typography.Text type="secondary">No stamps...</Typography.Text>) : (
                                <div className="flex flex-wrap gap-2">
                                    {savedStamps.map(stamp => (
                                        <button
                                            key={stamp.id}
                                            type="button"
                                            // UPDATED onClick
                                            onClick={() => handleSelectStampForPlacing(stamp)}
                                            className={`p-1 border rounded-full transition-all ${selectedStampUrl === stamp.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`}
                                            title={stamp.name || `Stamp`}
                                        >
                                            <AntImage src={stamp.r2Url} alt={stamp.name || 'Stamp'} width={45} height={45} preview={false} className="object-contain rounded-full" />
                                        </button>
                                    ))}
                                </div>
                            )}
                             {/* Optional: Show warning if needed */}
                            {/* {!placedItems.some(i => i.type === 'stamp') && savedStamps.length > 0 && <Typography.Text type="warning" className="text-xs block mt-1">Please place a stamp.</Typography.Text>} */}
                        </div>

                         {/* Optional: List placed items with delete button */}
                         {placedItems.length > 0 && (
                            <div>
                                <Typography.Title level={5} style={{ marginBottom: '8px' }}>Placed Items</Typography.Title>
                                <ul className="list-disc list-inside text-xs">
                                    {placedItems.map(item => (
                                        <li key={item.id} className="mb-1">
                                            {item.type} on page {item.pageNumber}
                                            <Button type="link" danger size="small" onClick={() => handleRemovePlacedItem(item.id)} className="ml-2">Remove</Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                         )}

                    </div> {/* End Selection Area */}
                </div> {/* End Flex Container */}
            </Modal>
        </div>
    );
};

export default UploadAndSignPdf;
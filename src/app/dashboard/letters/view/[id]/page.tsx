'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Typography, Button, Descriptions, Card, message, Row, Col, Space, Tooltip } from 'antd'; // Added Space, Tooltip
import { ArrowLeftOutlined, ZoomInOutlined, ZoomOutOutlined, UndoOutlined, DownloadOutlined } from '@ant-design/icons'; // Added DownloadOutlined
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { API_URL } from '@/app/config'; //

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

const { Title, Text, Paragraph } = Typography;

// Constants for QR code rendering
const QR_PLACEHOLDER_COLOR = 'rgba(0, 150, 50, 0.7)';
const QR_PLACEHOLDER_TEXT = 'QR';

// Interface for placements (QR codes, signatures, etc.)
interface PlacementInfo {
    id?: string;
    type: 'signature' | 'stamp' | 'qrcode';
    url?: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface LetterDetail {
    id: string;
    name?: string | null;
    createdAt: string;
    templateId?: string | null;
    formData?: Record<string, any> | null;
    signedPdfUrl?: string | null; // Main field for the signed PDF path/key
    originalPdfFileId?: string | null;
    finalSignedPdfUrl?: string | null; // Added based on model - maybe use this?
    qrCodeUrl?: string | null; // Added based on model
    workflowStatus?: string; // Added for checking if letter is approved
    placements?: PlacementInfo[] | null; // Added for QR code placements
    template?: {
        id: string;
        name: string;
    } | null;
    user?: {
        id: string;
        firstName?: string;
        lastName?: string;
    } | null;
}

async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const config: RequestInit = { method, headers, credentials: 'include' };
    if (body && method === 'POST') {
        config.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_URL}${endpoint}`, config); //
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! status: ${response.status}` };
        try {
            errorData = await response.json();
        } catch (e) { }
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return await response.json() as T;
}


const LetterViewPageContent = () => {
    const router = useRouter();
    const params = useParams();
    const letterId = params?.id as string;

    const [letterData, setLetterData] = useState<LetterDetail | null>(null);
    const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState<boolean>(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfScale, setPdfScale] = useState<number>(1.0); // Added for zoom
    // Add page dimensions state for QR code rendering
    const [pageDimensions, setPageDimensions] = useState<{ [key: number]: { width: number; height: number } }>({});

    // Function to handle download click with feedback
    const handleDownloadClick = () => {
        if (pdfViewUrl) {
            message.success('Downloading PDF. If download doesn\'t start automatically, please check your browser settings.');
            // Backup direct download method
            setTimeout(() => {
                try {
                    const link = document.createElement('a');
                    link.href = pdfViewUrl;
                    link.download = letterData?.name || `letter-${letterData?.id}.pdf`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (err) {
                    console.error('Error initiating direct download:', err);
                    // We already showed a success message, so don't show an error
                    // unless the user reports issues with the download
                }
            }, 100);
        } else {
            message.error('Download URL not available. Please try again later.');
        }
    };

    useEffect(() => {
        const fetchLetterAndUrl = async () => {
            if (!letterId) {
                setError("Letter ID not found in URL.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            setPdfViewUrl(null);
            setLetterData(null);
            try {
                const fetchedLetter = await apiRequest<LetterDetail>(`/letters/${letterId}`);
                setLetterData(fetchedLetter);

                const pdfPathToView = fetchedLetter.finalSignedPdfUrl || fetchedLetter.signedPdfUrl;

                if (pdfPathToView && !fetchedLetter.templateId) {
                    setPdfLoading(true);
                    setPdfError(null);
                    try {
                        
                        const urlResponse = await apiRequest<{ viewUrl: string }>(`/letters/${letterId}/view-url`);
                        if (urlResponse?.viewUrl) {
                            setPdfViewUrl(urlResponse.viewUrl);
                        } else {
                            throw new Error("View URL not received from backend.");
                        }
                    } catch (urlError: any) {
                        setPdfError(`Failed to load PDF view URL: ${urlError.message}`);
                        message.error(`Could not load PDF for viewing: ${urlError.message}`);
                    } finally {
                        setPdfLoading(false);
                    }
                } else if (!pdfPathToView && !fetchedLetter.templateId) {
                    // Handle case where it's a PDF-based letter but no URL is stored
                    setPdfError("No signed PDF URL found for this letter.");
                }
            } catch (fetchError: any) {
                setError(`Failed to load letter: ${fetchError.message}`);
                message.error(`Failed to load letter: ${fetchError.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchLetterAndUrl();
    }, [letterId]);

    const renderFormData = (formData: Record<string, any>) => {
        return (
            <Descriptions bordered column={1} size="small">
                {Object.entries(formData).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}>
                        {String(value)}
                    </Descriptions.Item>
                ))}
            </Descriptions>
        );
    };

    // --- PDF Control Handlers ---
    const handleZoomIn = () => setPdfScale(prev => Math.min(prev + 0.2, 3.0));
    const handleZoomOut = () => setPdfScale(prev => Math.max(prev - 0.2, 0.4));
    const handleResetZoom = () => setPdfScale(1.0);
    const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
    const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));
    // --- End PDF Control Handlers ---

    if (loading) {
         return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" tip="Loading letter..." /></div>;
    }

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon closable onClose={() => setError(null)} />;
    }

    if (!letterData) {
        return <Alert message="Letter not found." type="warning" showIcon />;
    }

    const isSignedPdf = !!(letterData.signedPdfUrl || letterData.finalSignedPdfUrl);
    const isTemplateBased = !!letterData.templateId && !!letterData.formData;
    const pdfSourceUrl = letterData.finalSignedPdfUrl || letterData.signedPdfUrl; // Prefer final signed

    return (
        <div style={{ padding: '20px' }}>
            <Card bordered={false}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    type="text"
                    onClick={() => router.back()}
                    style={{ marginBottom: '15px' }}
                >
                    Back
                </Button>
                <Title level={3}>{letterData.name || 'Letter Details'}</Title>
                
                {/* Add a prominent download button for approved letters */}
                {letterData.workflowStatus === 'approved' && pdfViewUrl && (
                    <div style={{ marginBottom: '15px' }}>
                        <Space>
                            <Button 
                                type="primary" 
                                icon={<DownloadOutlined />}
                                href={pdfViewUrl}
                                target="_blank"
                                download={letterData.name || `letter-${letterData.id}.pdf`}
                                onClick={handleDownloadClick}
                            >
                                Download Approved PDF
                            </Button>
                            <Button
                                type="default"
                                onClick={handleDownloadClick}
                            >
                                Alternative Download
                            </Button>
                        </Space>
                        <div style={{ marginTop: '5px', fontSize: '12px', color: 'gray' }}>
                            If the primary download doesn't work, try the alternative download button.
                        </div>
                        {letterData.placements?.some(p => p.type === 'qrcode') && (
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '4px', fontSize: '14px' }}>
                                <strong>Note:</strong> This PDF includes embedded QR codes at the positions specified during review.
                                The QR codes are permanently embedded in the document and should appear when you open the downloaded PDF.
                            </div>
                        )}
                    </div>
                )}
                
                <Descriptions size="small" bordered column={2} style={{ marginBottom: '20px' }}>
                    <Descriptions.Item label="Letter ID">{letterData.id}</Descriptions.Item>
                    <Descriptions.Item label="Created At">{new Date(letterData.createdAt).toLocaleString('en-GB')}</Descriptions.Item>
                    {isTemplateBased && letterData.template && (
                         <Descriptions.Item label="Based on Template">{letterData.template.name} ({letterData.template.id})</Descriptions.Item>
                    )}
                     {letterData.originalPdfFileId && ( // Show original ID if available
                         <Descriptions.Item label="Original PDF ID">{letterData.originalPdfFileId}</Descriptions.Item>
                    )}
                     <Descriptions.Item label="Type">{isSignedPdf ? "Signed PDF Document" : isTemplateBased ? "Template Based" : "Unknown"}</Descriptions.Item>
                    {letterData.workflowStatus && (
                        <Descriptions.Item label="Status">
                            <span style={{ 
                                color: letterData.workflowStatus === 'approved' ? 'green' : 
                                       letterData.workflowStatus === 'rejected' ? 'red' : 'orange',
                                fontWeight: 'bold'
                            }}>
                                {letterData.workflowStatus.charAt(0).toUpperCase() + letterData.workflowStatus.slice(1)}
                            </span>
                            {letterData.workflowStatus === 'approved' && (
                                <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                                    (PDF is available for download)
                                </span>
                            )}
                        </Descriptions.Item>
                    )}
                    {letterData.qrCodeUrl && (
                        <Descriptions.Item label="QR Code" span={2}>
                            <img src={letterData.qrCodeUrl} alt="Letter QR Code" style={{ width: '100px', height: '100px' }} />
                        </Descriptions.Item>
                    )}
                </Descriptions>
                <div>
                    {/* --- PDF Display Section --- */}
                    {isSignedPdf && (
                        <>
                            <Title level={4}>Document Viewer</Title>
                            {pdfLoading && <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip="Loading PDF viewer..." /></div>}
                            {pdfError && <Alert message="PDF Load Error" description={pdfError} type="error" showIcon />}
                            {pdfViewUrl && !pdfError && (
                                <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col">
                                    {/* --- PDF Controls --- */}
                                    <div className="flex justify-between items-center p-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10 mb-2">
                                        <div>
                                            {numPages && numPages > 1 && (
                                                <Space>
                                                    <Button onClick={goToPrevPage} disabled={pageNumber <= 1} size="small">Previous</Button>
                                                    <span> Page {pageNumber} of {numPages} </span>
                                                    <Button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} size="small">Next</Button>
                                                </Space>
                                            )}
                                        </div>
                                        <Space>
                                            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= 0.4 || !numPages} size="small" />
                                            <Tooltip title="Reset Zoom"><Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1.0 || !numPages} size="small" /></Tooltip>
                                            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= 3.0 || !numPages} size="small" />
                                            <span className="text-sm font-semibold w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                                            {/* Download button - only visible for approved letters */}
                                            {letterData.workflowStatus === 'approved' && pdfViewUrl && (
                                                <Tooltip title="Download PDF">
                                                    <Button 
                                                        icon={<DownloadOutlined />} 
                                                        size="small" 
                                                        type="primary"
                                                        href={pdfViewUrl} 
                                                        target="_blank" 
                                                        download={letterData.name || `letter-${letterData.id}.pdf`}
                                                        onClick={handleDownloadClick}
                                                    />
                                                </Tooltip>
                                            )}
                                        </Space>
                                    </div>
                                    {/* --- PDF Document Area --- */}
                                    <div className="flex-1 overflow-auto p-2 bg-gray-50" style={{ maxHeight: '75vh' }}>
                                         <Document
                                             file={pdfViewUrl}
                                             onLoadSuccess={({ numPages: totalPages }) => { setNumPages(totalPages); if (pageNumber > totalPages) setPageNumber(1); setPdfError(null); }}
                                             onLoadError={(err) => { console.error("PDF Load Error:", err); setPdfError(`Failed to load PDF: ${err.message}`); setNumPages(null); }}
                                             loading={<div className="text-center p-10"><Spin tip="Loading PDF document..." /></div>}
                                             error={<Alert message="Error" description={pdfError || "Could not load PDF document."} type="error" showIcon />}
                                             className="flex justify-center items-start"
                                         >
                                             <Page
                                                 key={`page_${pageNumber}`} // Re-render page on number change
                                                 pageNumber={pageNumber}
                                                 scale={pdfScale}
                                                 onLoadSuccess={page => {
                                                    // Store page dimensions for QR code placement
                                                    const viewport = page.getViewport({ scale: 1 });
                                                    setPageDimensions(prev => ({
                                                        ...prev,
                                                        [pageNumber]: { width: viewport.width, height: viewport.height }
                                                    }));
                                                 }}
                                                 renderTextLayer={true}
                                                 renderAnnotationLayer={false}
                                                 className="shadow-lg"
                                                 loading={<div style={{ height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin /></div>}
                                                 error={<div className="text-red-500">Failed to render page {pageNumber}.</div>}
                                             >
                                                {/* Render QR code placeholders */}
                                                {letterData?.placements?.filter(item => 
                                                    item.type === 'qrcode' && item.pageNumber === pageNumber
                                                ).map(item => {
                                                    const dims = pageDimensions[pageNumber];
                                                    if (!dims) return null;
                                                    
                                                    // Calculate scaled dimensions based on current PDF scale
                                                    const scaledX = item.x * pdfScale;
                                                    const scaledY = item.y * pdfScale;
                                                    const scaledWidth = item.width * pdfScale;
                                                    const scaledHeight = item.height * pdfScale;
                                                    
                                                    // If the letter is approved and has a QR code, we display it differently
                                                    // than a placeholder
                                                    const isApproved = letterData.workflowStatus === 'approved';
                                                    
                                                    if (isApproved && letterData.qrCodeUrl) {
                                                        // For approved letters, show the actual QR code image
                                                        return (
                                                            <Tooltip key={item.id || `qr-${pageNumber}-${scaledX}-${scaledY}`} title="QR Code">
                                                                <img
                                                                    src={letterData.qrCodeUrl}
                                                                    alt="QR Code"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        left: `${scaledX}px`,
                                                                        top: `${scaledY}px`,
                                                                        width: `${scaledWidth}px`,
                                                                        height: `${scaledHeight}px`,
                                                                        userSelect: 'none',
                                                                        zIndex: 10
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        );
                                                    } else {
                                                        // For non-approved letters or those without QR URL, show the placeholder
                                                        return (
                                                            <Tooltip key={item.id || `qr-${pageNumber}-${scaledX}-${scaledY}`} title="QR Code Placeholder">
                                                                <div
                                                                    style={{
                                                                        position: 'absolute',
                                                                        left: `${scaledX}px`,
                                                                        top: `${scaledY}px`,
                                                                        width: `${scaledWidth}px`,
                                                                        height: `${scaledHeight}px`,
                                                                        border: `2px dashed ${QR_PLACEHOLDER_COLOR}`,
                                                                        backgroundColor: 'rgba(0, 150, 50, 0.1)',
                                                                        userSelect: 'none',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: Math.min(scaledWidth, scaledHeight) * 0.4,
                                                                        color: QR_PLACEHOLDER_COLOR,
                                                                        fontWeight: 'bold',
                                                                        boxSizing: 'border-box',
                                                                        zIndex: 10
                                                                    }}
                                                                >
                                                                    {QR_PLACEHOLDER_TEXT}
                                                                </div>
                                                            </Tooltip>
                                                        );
                                                    }
                                                })}
                                             </Page>
                                        </Document>
                                    </div>
                                </div>
                            )}
                            {!pdfViewUrl && !pdfLoading && !pdfError && (
                                <Alert message="PDF URL not found or loading failed." description="Could not retrieve the URL to display the PDF document." type="warning" showIcon />
                            )}
                        </>
                    )}
                    {/* --- Template Data Display Section --- */}
                    {isTemplateBased && (
                         <>
                            <Title level={4}>Letter Data (from Template: {letterData.template?.name})</Title>
                             {letterData.formData ? renderFormData(letterData.formData) : <Text type="secondary">No form data available.</Text>}
                             <Paragraph type="secondary" style={{marginTop: '15px'}}>
                                 (Showing data used to generate the letter.)
                             </Paragraph>
                         </>
                    )}
                    {/* --- Fallback Message --- */}
                    {!isSignedPdf && !isTemplateBased && (
                         <Alert message="Cannot display letter content." description="Letter type is unclear or necessary data is missing." type="warning" showIcon />
                    )}
                </div>
            </Card>
        </div>
    );
};


export default function LetterViewPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" tip="Loading Page..." /></div>}>
      <LetterViewPageContent />
    </Suspense>
  );
}
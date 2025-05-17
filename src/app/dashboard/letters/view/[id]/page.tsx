'use client';

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Typography, Button, Descriptions, Card, message, Space, Tooltip, Image as AntImage } from 'antd';
import { ArrowLeftOutlined, ZoomInOutlined, ZoomOutOutlined, UndoOutlined, DownloadOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { API_URL } from '@/app/config';
import CkeditorOzel from '../../../CreateLetter/ckeditor_letter';

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

const { Title, Text, Paragraph } = Typography;

interface PlacementInfo {
    id?: string;
    type: 'signature' | 'stamp' | 'qrcode';
    url?: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xPct?: number;
    yPct?: number;
    widthPct?: number;
    heightPct?: number;
}

interface LetterDetail {
    id: string;
    name?: string | null;
    createdAt: string;
    templateId?: string | null;
    content: string;
    formData?: Record<string, any> | null;
    signedPdfUrl?: string | null;
    originalPdfFileId?: string | null;
    finalSignedPdfUrl?: string | null;
    qrCodeUrl?: string | null;
    workflowStatus?: string;
    signatureUrl?: string | null;
    stampUrl?: string | null;
    placements?: PlacementInfo[] | null;
    template?: {
        id: string;
        name: string;
        content?: string;
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
    const response = await fetch(`${API_URL}${endpoint}`, config);
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! status: ${response.status}` };
        try {
            errorData = await response.json();
        } catch (e) {}
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return await response.json() as T;
}

// Component to display template-based letter with proper placements of signature, stamp, and QR code
function TemplateLetter({ 
    letterData, 
}: { 
    letterData: LetterDetail
}) {
    const [processedContent, setProcessedContent] = useState<string>('');
    const [editorElement, setEditorElement] = useState<HTMLElement | null>(null);
    
    // Setup reference to editor element for placement positioning
    const editorRef = useRef<HTMLDivElement>(null);
    const [editorReady, setEditorReady] = useState(false);

    // Process the template content and form data to replace placeholders
    useEffect(() => {
        if (letterData?.template?.content && letterData?.formData) {
            const renderedContent = renderContentWithPlaceholders(letterData.template.content, letterData.formData);
            setProcessedContent(renderedContent);
        } else if (letterData?.content) {
            setProcessedContent(letterData.content);
        }
    }, [letterData]);

    // Set up editor reference and track when it's ready
    useEffect(() => {
        // Find the editor element after content is rendered
        const checkEditor = () => {
            const editorEl = document.querySelector('.ck-editor__editable');
            if (editorEl instanceof HTMLElement) {
                setEditorElement(editorEl);
                setEditorReady(true);
            } else {
                // Retry if not found
                setTimeout(checkEditor, 500);
            }
        };
        
        if (processedContent) {
            setTimeout(checkEditor, 300);
        }
        
        return () => {
            setEditorReady(false);
            setEditorElement(null);
        };
    }, [processedContent]);

    // Replace placeholders in the content with form data values
    const renderContentWithPlaceholders = (content: string, formData: Record<string, any>): string => {
        if (!content) return '';
        return content.replace(/#([a-zA-Z0-9-]+)#/g, (match, p1) => {
            return formData[p1] || '';
        });
    };

    // Render placements (signature, stamp, QR code) on top of the letter content
    const renderPlacements = () => {
        if (!letterData.placements || letterData.placements.length === 0) {
            return null;
        }

        console.log("Rendering placements with editor ready:", editorReady);
        
        return letterData.placements.map((item, index) => {
            // Determine whether to use percentage or absolute positioning
            let left, top, width, height;
            
            if (item.xPct !== undefined && item.yPct !== undefined) {
                // Use percentage-based positioning from LetterReview
                left = `${item.xPct * 100}%`;
                top = `${item.yPct * 100}%`;
                width = `${(item.widthPct || 0.1) * 100}%`;
                height = `${(item.heightPct || 0.1) * 100}%`;
            } else {
                // Use absolute positioning with pixels from backend
                left = `${item.x}px`;
                top = `${item.y}px`;
                width = `${item.width}px`;
                height = `${item.height}px`;
            }
            
            const style: React.CSSProperties = {
                position: 'absolute',
                left,
                top,
                width,
                height,
                zIndex: 1000, // High z-index to ensure visibility
                pointerEvents: 'none',
                border: process.env.NODE_ENV === 'development' ? '1px dashed rgba(255,0,0,0.2)' : 'none' // Debug border in dev mode
            };

            // Handle QR code placement
            if (item.type === 'qrcode') {
                // For QR code, use the letterData.qrCodeUrl instead of item.url
                return letterData.qrCodeUrl ? (
                    <img
                        key={`qr-${index}`}
                        src={letterData.qrCodeUrl}
                        alt="QR Code"
                        style={{
                            ...style,
                            objectFit: 'contain',
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                    />
                ) : (
                    <div
                        key={`qr-placeholder-${index}`}
                        style={{
                            ...style,
                            backgroundColor: 'rgba(0, 150, 50, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            border: '2px dashed white',
                        }}
                    >
                        QR
                    </div>
                );
            } else if (item.url) {
                // For signature and stamp
                return (
                    <img
                        key={`${item.type}-${index}`}
                        src={item.url}
                        alt={item.type}
                        style={{
                            ...style,
                            objectFit: 'contain',
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                    />
                );
            }
            return null;
        }).filter(Boolean);
    };

    // Determine whether to display default elements at the bottom if no explicit placements
    const showDefaultElements = () => {
        // Never show fallback elements if there are already placements
        if (letterData.placements && letterData.placements.length > 0) {
            return false;
        }
        
        // Only show default elements for approved letters
        return letterData.workflowStatus === 'approved';
    };

    // Fallback signature and stamp display
    const renderFallbackElements = () => {
        if (!showDefaultElements()) {
            return null;
        }
        
        return (
            <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end h-24">
                {letterData.signatureUrl && (
                    <div className="flex flex-col items-center">
                        <AntImage 
                            src={letterData.signatureUrl} 
                            alt="Signature" 
                            width={100} 
                            height={40} 
                            preview={false}
                        />
                        <Text className="text-xs mt-1">Signature</Text>
                    </div>
                )}
                {letterData.stampUrl && (
                    <div className="flex flex-col items-center">
                        <AntImage 
                            src={letterData.stampUrl} 
                            alt="Stamp" 
                            width={60} 
                            height={60} 
                            preview={false}
                            className="rounded-full"
                        />
                        <Text className="text-xs mt-1">Stamp</Text>
                    </div>
                )}
                {letterData.qrCodeUrl && (
                    <div className="flex flex-col items-center">
                        <AntImage 
                            src={letterData.qrCodeUrl} 
                            alt="QR Code" 
                            width={50} 
                            height={50} 
                            preview={false}
                        />
                        <Text className="text-xs mt-1">QR Code</Text>
                    </div>
                )}
            </div>
        );
    };

    if (!processedContent) {
        return <div className="flex items-center justify-center h-64 text-gray-500">Letter content could not be loaded.</div>;
    }

    console.log("Rendering letter with editor ready:", editorReady, "placements:", letterData.placements?.length || 0);

    return (
        <div className="relative bg-white rounded-lg shadow border border-gray-200 min-h-[800px] text-sm font-serif leading-relaxed" ref={editorRef}>
            <div className="relative">
                <CkeditorOzel
                    onChange={() => {}}
                    initialData={processedContent}
                    customFields={[]}
                    readOnly={true}
                />
                
                {/* Container for placements - absolute position on top of editor */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {editorReady && renderPlacements()}
                    {renderFallbackElements()}
                </div>
            </div>
            
            <style jsx>{`
                .ck-editor-wrapper {
                    padding: 2rem 3rem;
                    max-height: 800px;
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
    const [pdfScale, setPdfScale] = useState<number>(1.0);

    const handleDownloadClick = () => {
        if (pdfViewUrl) {
            message.success('Downloading PDF. If download doesn\'t start, check your browser settings.');
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
                    console.error('Error initiating download:', err);
                }
            }, 100);
        } else {
            message.error('Download URL not available.');
        }
    };

    useEffect(() => {
        const fetchLetterAndUrl = async () => {
            if (!letterId) {
                setError('Letter ID not found in URL.');
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            setPdfViewUrl(null);
            setLetterData(null);
            try {
                const fetchedLetter = await apiRequest<LetterDetail>(`/letters/${letterId}`);
                console.log('Fetched letter data:', fetchedLetter);
                setLetterData(fetchedLetter);

                // For PDF-based letters or approved template-based letters with finalSignedPdfUrl
                const pdfPathToView = fetchedLetter.finalSignedPdfUrl || fetchedLetter.signedPdfUrl;

                if (pdfPathToView) {
                    setPdfLoading(true);
                    setPdfError(null);
                    try {
                        const urlResponse = await apiRequest<{ viewUrl: string }>(`/letters/${letterId}/view-url`);
                        console.log('PDF view URL response:', urlResponse);
                        if (urlResponse?.viewUrl) {
                            setPdfViewUrl(urlResponse.viewUrl);
                        } else {
                            throw new Error('View URL not received from backend.');
                        }
                    } catch (urlError: any) {
                        setPdfError(`Failed to load PDF view URL: ${urlError.message}`);
                        message.error(`Could not load PDF: ${urlError.message}`);
                    } finally {
                        setPdfLoading(false);
                    }
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

    const handleZoomIn = () => setPdfScale(prev => Math.min(prev + 0.2, 3.0));
    const handleZoomOut = () => setPdfScale(prev => Math.max(prev - 0.2, 0.4));
    const handleResetZoom = () => setPdfScale(1.0);
    const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
    const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

    // Determine letter type and display mode
    const isSignedPdf = !!(letterData?.finalSignedPdfUrl || letterData?.signedPdfUrl);
    const isTemplateBased = !!letterData?.templateId && !!(letterData?.formData || letterData?.content);
    
    // Choose display mode - if we have a PDF and it's either:
    // 1. A PDF-based letter OR
    // 2. An approved template-based letter with final PDF
    const showPdfViewer = isSignedPdf && 
        (!isTemplateBased || 
        (isTemplateBased && letterData?.workflowStatus === 'approved' && !!pdfViewUrl));
    
    // Show template viewer for template-based letters
    const showTemplateViewer = isTemplateBased;

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" tip="Loading letter..." /></div>;
    }

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon closable onClose={() => setError(null)} />;
    }

    if (!letterData) {
        return <Alert message="Letter not found." type="warning" showIcon />;
    }

    return (
        <div className="flex flex-col min-h-screen p-4 md:p-8 bg-gray-100">
            <Card bordered={false} className="shadow-lg rounded-lg mb-6">
                <Button
                    icon={<ArrowLeftOutlined />}
                    type="text"
                    onClick={() => router.back()}
                    style={{ marginBottom: '15px' }}
                >
                    Back
                </Button>
                <Title level={3} className="text-center">{letterData.name || 'Letter Details'}</Title>
            </Card>

            {letterData.workflowStatus === 'approved' && pdfViewUrl && (
                <Card bordered={false} className="shadow-lg rounded-lg mb-6">
                    <div className="flex justify-center mb-4">
                        <Space>
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={handleDownloadClick}
                            >
                                Download Approved PDF
                            </Button>
                        </Space>
                    </div>
                </Card>
            )}

            <Card bordered={false} className="shadow-lg rounded-lg mb-6">
                <Descriptions size="small" bordered column={2}>
                    <Descriptions.Item label="Letter ID">{letterData.id}</Descriptions.Item>
                    <Descriptions.Item label="Created At">{new Date(letterData.createdAt).toLocaleString('en-GB')}</Descriptions.Item>
                    {letterData.template && (
                        <Descriptions.Item label="Based on Template">{letterData.template.name} ({letterData.template.id})</Descriptions.Item>
                    )}
                    {letterData.originalPdfFileId && (
                        <Descriptions.Item label="Original PDF ID">{letterData.originalPdfFileId}</Descriptions.Item>
                    )}
                    <Descriptions.Item label="Type">{letterData.templateId ? 'Template Based' : 'PDF Based'}</Descriptions.Item>
                    {letterData.workflowStatus && (
                        <Descriptions.Item label="Status">
                            <span
                                style={{
                                    color:
                                        letterData.workflowStatus === 'approved'
                                            ? 'green'
                                            : letterData.workflowStatus === 'rejected'
                                            ? 'red'
                                            : 'orange',
                                    fontWeight: 'bold',
                                }}
                            >
                                {letterData.workflowStatus.charAt(0).toUpperCase() + letterData.workflowStatus.slice(1)}
                            </span>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>

            {/* Display both template viewer and PDF viewer if needed */}
            {showTemplateViewer && (
                <Card bordered={false} className="shadow-lg rounded-lg mb-6">
                    <Title level={4} className="text-center">Letter Content (Template View)</Title>
                    <div className="flex justify-center items-center mt-4">
                        <div className="w-full max-w-4xl">
                            <TemplateLetter letterData={letterData} />
                        </div>
                    </div>
                </Card>
            )}

            {showPdfViewer && pdfViewUrl && (
                <Card bordered={false} className="shadow-lg rounded-lg mb-6">
                    <Title level={4} className="text-center">PDF Document View</Title>
                    {pdfLoading && <div className="text-center p-12"><Spin tip="Loading PDF viewer..." /></div>}
                    {pdfError && <Alert message="PDF Load Error" description={pdfError} type="error" showIcon />}
                    {!pdfLoading && !pdfError && (
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col">
                            <div className="flex justify-between items-center p-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10 mb-2">
                                <div>
                                    {numPages && numPages > 1 && (
                                        <Space>
                                            <Button onClick={goToPrevPage} disabled={pageNumber <= 1} size="small">
                                                Previous
                                            </Button>
                                            <span>Page {pageNumber} of {numPages}</span>
                                            <Button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} size="small">
                                                Next
                                            </Button>
                                        </Space>
                                    )}
                                </div>
                                <Space>
                                    <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= 0.4 || !numPages} size="small" />
                                    <Tooltip title="Reset Zoom">
                                        <Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1.0 || !numPages} size="small" />
                                    </Tooltip>
                                    <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= 3.0 || !numPages} size="small" />
                                    <span className="text-sm font-semibold w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                                    {letterData.workflowStatus === 'approved' && pdfViewUrl && (
                                        <Tooltip title="Download PDF">
                                            <Button
                                                icon={<DownloadOutlined />}
                                                size="small"
                                                type="primary"
                                                onClick={handleDownloadClick}
                                            />
                                        </Tooltip>
                                    )}
                                </Space>
                            </div>
                            <div className="flex-1 overflow-auto p-2 bg-gray-50" style={{ maxHeight: '75vh' }}>
                                <Document
                                    file={pdfViewUrl}
                                    onLoadSuccess={({ numPages: totalPages }) => {
                                        setNumPages(totalPages);
                                        if (pageNumber > totalPages) setPageNumber(1);
                                        setPdfError(null);
                                    }}
                                    onLoadError={(err) => {
                                        console.error('PDF Load Error:', err);
                                        setPdfError(`Failed to load PDF: ${err.message}`);
                                        setNumPages(null);
                                    }}
                                    loading={<div className="text-center p-10"><Spin tip="Loading PDF document..." /></div>}
                                    error={<Alert message="Error" description={pdfError || 'Could not load PDF document.'} type="error" showIcon />}
                                    className="flex justify-center items-start"
                                >
                                    <Page
                                        key={`page_${pageNumber}`}
                                        pageNumber={pageNumber}
                                        scale={pdfScale}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={false}
                                        className="shadow-lg"
                                        loading={
                                            <div style={{ height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                <Spin />
                                            </div>
                                        }
                                        error={<div className="text-red-500">Failed to render page {pageNumber}.</div>}
                                    />
                                </Document>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {(!showPdfViewer && !showTemplateViewer) && (
                <Card bordered={false} className="shadow-lg rounded-lg">
                    <Alert
                        message="Cannot display letter content."
                        description="Letter type is unclear or necessary data is missing."
                        type="warning"
                        showIcon
                    />
                </Card>
            )}
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
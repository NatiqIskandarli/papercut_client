'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Typography, Button, Descriptions, Card, message, Row, Col, Space, Tooltip } from 'antd'; // Added Space, Tooltip
import { ArrowLeftOutlined, ZoomInOutlined, ZoomOutOutlined, UndoOutlined } from '@ant-design/icons'; // Added Zoom Icons
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { API_URL } from '@/app/config'; //

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

const { Title, Text, Paragraph } = Typography;

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
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token_w') : null;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const config: RequestInit = { method, headers };
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
                                                 renderTextLayer={true}
                                                 renderAnnotationLayer={false}
                                                 className="shadow-lg"
                                                 loading={<div style={{ height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin /></div>}
                                                 error={<div className="text-red-500">Failed to render page {pageNumber}.</div>}
                                             />
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
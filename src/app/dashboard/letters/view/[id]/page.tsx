// app/dashboard/letters/view/[id]/page.tsx

'use client';

import React, { useState, useEffect, Suspense } from 'react'; // Suspense import edildi
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Typography, Button, Descriptions, Card, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { API_URL } from '@/app/config';

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

const { Title, Text, Paragraph } = Typography;

interface LetterDetail {
    id: string;
    name?: string | null;
    createdAt: string;
    templateId?: string | null;
    formData?: Record<string, any> | null;
    signedPdfUrl?: string | null;
    originalPdfFileId?: string | null;
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
    const response = await fetch(`${API_URL}${endpoint}`, config);
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
                if (fetchedLetter.signedPdfUrl && !fetchedLetter.templateId) {
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

    if (loading) {
         return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" tip="Loading letter..." /></div>;
    }

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon closable onClose={() => setError(null)} />;
    }

    if (!letterData) {
        return <Alert message="Letter not found." type="warning" showIcon />;
    }

    const isSignedPdf = !!letterData.signedPdfUrl;
    const isTemplateBased = !!letterData.templateId && !!letterData.formData;

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
                     {isSignedPdf && letterData.originalPdfFileId && (
                         <Descriptions.Item label="Based on Original PDF ID">{letterData.originalPdfFileId}</Descriptions.Item>
                    )}
                     <Descriptions.Item label="Type">{isSignedPdf ? "Signed PDF Document" : isTemplateBased ? "Template Based" : "Unknown"}</Descriptions.Item>
                </Descriptions>
                <div>
                    {isSignedPdf && (
                        <>
                            <Title level={4}>Signed Document</Title>
                            {pdfLoading && <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip="Loading PDF viewer..." /></div>}
                            {pdfError && <Alert message="PDF Load Error" description={pdfError} type="error" showIcon />}
                            {pdfViewUrl && !pdfError && (
                                <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
                                    <Document
                                        file={pdfViewUrl}
                                        onLoadSuccess={({ numPages: totalPages }) => { setNumPages(totalPages); setPageNumber(1); setPdfError(null); }}
                                        onLoadError={(err) => { setPdfError(`react-pdf error: ${err.message}`); }}
                                        loading={<div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip="Loading PDF document..." /></div>}
                                        error={<div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>Failed to display PDF.</div>}
                                    >
                                        {Array.from(new Array(numPages || 0), (el, index) => (
                                             <Page
                                                key={`page_${index + 1}`}
                                                pageNumber={index + 1}
                                                renderTextLayer={true}
                                                renderAnnotationLayer={false}
                                            />
                                        ))}
                                    </Document>
                                </div>
                            )}
                            {!pdfViewUrl && !pdfLoading && !pdfError && (
                                <Alert message="PDF view URL is not available." type="warning" showIcon />
                            )}
                        </>
                    )}
                    {isTemplateBased && (
                         <>
                            <Title level={4}>Letter Data (from Template: {letterData.template?.name})</Title>
                             {letterData.formData ? renderFormData(letterData.formData) : <Text type="secondary">No form data available.</Text>}
                             <Paragraph type="secondary" style={{marginTop: '15px'}}>
                                 (Showing data used to generate the letter.)
                             </Paragraph>
                         </>
                    )}
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
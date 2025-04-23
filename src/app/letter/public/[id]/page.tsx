// frontend/app/letter/public/[id]/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Spin, Alert, Typography, Button, Space, Tooltip, Card } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, UndoOutlined, DownloadOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '')}/public` : 'http://localhost:4000/public';

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

const { Title, Text } = Typography;

interface PublicLetterData {
    id: string;
    name?: string | null;
    finalSignedPdfUrl?: string | null; 
    createdAt?: Date;
}

async function publicApiRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${PUBLIC_API_URL}${endpoint}`); 
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! status: ${response.status}` };
        try {
            errorData = await response.json();
        } catch (e) { }
        // Use status code for specific errors if needed (e.g., 404)
        if (response.status === 404) {
             throw new Error(errorData?.message || 'Approved letter not found.');
        }
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
}

const PublicLetterViewContent = () => {
    const params = useParams();
    const letterId = params?.id as string;

    const [letterData, setLetterData] = useState<PublicLetterData | null>(null);
    const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null); // This will hold the R2 view URL
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState<boolean>(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfScale, setPdfScale] = useState<number>(1.0);

    useEffect(() => {
        const fetchPublicLetter = async () => {
            if (!letterId) {
                setError("Letter ID not found in URL.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            setLetterData(null);
            setPdfViewUrl(null); // Reset PDF view URL

            try {
                // 1. Fetch public letter details (which includes the PDF key/path)
                const fetchedLetter = await publicApiRequest<PublicLetterData>(`/letters/${letterId}`);
                setLetterData(fetchedLetter);

                // 2. If path exists, fetch the actual view URL for the PDF from our public endpoint
                if (fetchedLetter.finalSignedPdfUrl) {
                    setPdfLoading(true);
                    setPdfError(null);
                    try {
                        // Encode the key in case it contains special characters like '/'
                        const encodedKey = encodeURIComponent(fetchedLetter.finalSignedPdfUrl);
                        const urlResponse = await publicApiRequest<{ viewUrl: string }>(`/letters/view-pdf/${encodedKey}`);
                        if (urlResponse?.viewUrl) {
                            setPdfViewUrl(urlResponse.viewUrl);
                        } else {
                            throw new Error("View URL not received from backend.");
                        }
                    } catch (urlError: any) {
                         setPdfError(`Failed to load PDF view URL: ${urlError.message}`);
                    } finally {
                         setPdfLoading(false);
                    }
                } else {
                    setPdfError("No final PDF URL found for this approved letter.");
                }

            } catch (fetchError: any) {
                setError(`Failed to load letter information: ${fetchError.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchPublicLetter();
    }, [letterId]);

    // PDF Control Handlers
    const handleZoomIn = () => setPdfScale(prev => Math.min(prev + 0.2, 3.0));
    const handleZoomOut = () => setPdfScale(prev => Math.max(prev - 0.2, 0.4));
    const handleResetZoom = () => setPdfScale(1.0);
    const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
    const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

    // --- Render Logic ---
    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90vh', background: '#f0f2f5' }}><Spin size="large" tip="Loading Document..." /></div>;
    }

    if (error) {
        // Use a more user-friendly error display for public page
        return (
             <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90vh', background: '#f0f2f5', padding: '20px' }}>
                 <Alert message="Error" description={error} type="error" showIcon />
             </div>
        );
    }

    if (!letterData || (!pdfViewUrl && !pdfLoading)) {
         return (
             <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90vh', background: '#f0f2f5', padding: '20px' }}>
                 <Alert message="Document Not Found" description="The requested document could not be loaded or is unavailable." type="warning" showIcon />
             </div>
         );
    }

    return (
        <div style={{ background: '#f0f2f5', minHeight: '100vh', padding: '20px 0' }}>
             <Card style={{ maxWidth: '1000px', margin: '0 auto' }}>
                 <Title level={3} style={{ textAlign: 'center', marginBottom: '20px' }}>{letterData.name || `Document ${letterData.id}`}</Title>

                 {pdfLoading && <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin tip="Loading PDF viewer..." /></div>}
                 {pdfError && <Alert message="PDF Load Error" description={pdfError} type="error" showIcon />}

                 {pdfViewUrl && !pdfError && (
                     <div className="pdf-viewer-container bg-white rounded-lg border border-gray-200 flex flex-col">
                         {/* PDF Controls */}
                         <div className="pdf-controls flex justify-between items-center p-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10 mb-2">
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
                                <Tooltip title="Download PDF">
                                    <Button icon={<DownloadOutlined />} size="small" href={pdfViewUrl} target="_blank" download={letterData.name || `document-${letterData.id}.pdf`} />
                                </Tooltip>
                                <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= 0.4 || !numPages} size="small" />
                                <Tooltip title="Reset Zoom"><Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1.0 || !numPages} size="small" /></Tooltip>
                                <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= 3.0 || !numPages} size="small" />
                                <span className="text-sm font-semibold w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                            </Space>
                         </div>
                         {/* PDF Document Area */}
                         <div className="pdf-document-area flex-1 overflow-auto p-2 bg-gray-200" style={{ maxHeight: '80vh' }}>
                              <Document
                                  file={pdfViewUrl}
                                  onLoadSuccess={({ numPages: totalPages }) => { setNumPages(totalPages); if (pageNumber > totalPages) setPageNumber(1); setPdfError(null); }}
                                  onLoadError={(err) => { console.error("PDF Load Error:", err); setPdfError(`Failed to load PDF: ${err.message}`); setNumPages(null); }}
                                  loading={<div className="text-center p-10"><Spin tip="Loading PDF document..." /></div>}
                                  error={<Alert message="Error" description={pdfError || "Could not load PDF document."} type="error" showIcon />}
                                  className="flex justify-center items-start"
                              >
                                  <Page
                                      key={`page_${pageNumber}`}
                                      pageNumber={pageNumber}
                                      scale={pdfScale}
                                      renderTextLayer={true}
                                      renderAnnotationLayer={false}
                                      className="pdf-page-shadow" // Add custom class for shadow
                                      loading={<div style={{ height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin /></div>}
                                      error={<div className="text-red-500">Failed to render page {pageNumber}.</div>}
                                  />
                             </Document>
                         </div>
                     </div>
                 )}
                  {/* Simple Footer */}
                  <div style={{ textAlign: 'center', marginTop: '20px', color: '#888', fontSize: '12px' }}>
                       <Text type="secondary">Document ID: {letterData.id}</Text>
                       {letterData.createdAt && <Text type="secondary" style={{ marginLeft: '10px' }}>Approved On: {new Date(letterData.createdAt).toLocaleDateString()}</Text>}
                   </div>
             </Card>
             {/* Add basic CSS for shadow if needed */}
             <style jsx global>{`
                .pdf-page-shadow {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    margin-bottom: 8px; /* Add margin between pages if needed */
                }
             `}</style>
        </div>
    );
};


// Main export using Suspense for data fetching state
export default function PublicLetterPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}><Spin size="large" tip="Loading Page..." /></div>}>
      <PublicLetterViewContent />
    </Suspense>
  );
}
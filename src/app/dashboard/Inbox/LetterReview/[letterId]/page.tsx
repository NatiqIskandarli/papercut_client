'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Button, Typography, Row, Col, message, Image as AntImage, Tag } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { getLetterById, getReferences, LetterDetailsApiResponse } from '@/utils/api';
import axios from 'axios';


interface Reference { id: string; name: string; type: string; }
interface DynamicDbData { companies: Array<{ id: string; name: string }>; vendors: Array<{ id: string; name: string }>; contracts: Array<{ id: string; name: string }>; customs: Array<{ id: string; name: string }>; documentTypes: Array<{ id: string; name: string }>; subContractorNames: Array<{ id: string; name: string }>; }
interface TemplateSectionData { id: string; title: string; content: string; }
interface SavedTemplate { id: string; name?: string | null; sections: TemplateSectionData[]; userId: string; createdAt: string; updatedAt: string; }

interface FormData {
    company: string; date: string; customs: string; person: string;
    vendor: string; contract: string; value: string; mode: string;
    reference: string;
    invoiceNumber: string; cargoName: string; cargoDescription: string;
    documentType: string; importPurpose: string; requestPerson: string;
    requestDepartment: string; declarationNumber: string; quantityBillNumber: string;
    subContractorName: string; subContractNumber: string;
    logoUrl: string | null;
    signatureUrl: string | null;
    stampUrl: string | null;
}



const { Title } = Typography;



const getFormFieldKeyFromPlaceholder = (placeholderId: string): keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'> | null => {
    const mapping: { [key: string]: keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'> } = {
        'company-1': 'company', 'date-1': 'date', 'customs-1': 'customs',
        'vendor-1': 'vendor', 'contract-1': 'contract', 'amount-1': 'value',
        'invoice-number': 'invoiceNumber', 'cargo-name': 'cargoName',
        'cargo-description': 'cargoDescription', 'document-type': 'documentType',
        'import-purpose': 'importPurpose', 'request-person': 'requestPerson',
        'request-department': 'requestDepartment', 'person': 'person',
        'subcontractor-name': 'subContractorName', 'subcontract-number': 'subContractNumber',
    };
    return mapping[placeholderId] as keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'> | null || null;
};


function LetterPreviewPanelReview({
    template,
    formData,
    dbData,
}: {
    template: SavedTemplate | null;
    formData: FormData;
    dbData: DynamicDbData;
}) {
    const renderContentWithPlaceholders = useCallback((text: string): React.ReactNode => {
        if (!text) return '';
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part, index) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1);
                const formFieldKey = getFormFieldKeyFromPlaceholder(fieldId);
                if (formFieldKey) {
                    const formValue = formData[formFieldKey];
                    let displayValue: string | number | readonly string[] | undefined = formValue;

                    const dropdownKeys: (keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>)[] = ['company', 'customs', 'vendor', 'contract', 'documentType', 'subContractorName'];
                    if (dropdownKeys.includes(formFieldKey) && formValue && dbData) {
                        const sourceKey = (formFieldKey === 'documentType' ? 'documentTypes' : formFieldKey === 'subContractorName' ? 'subContractorNames' : `${formFieldKey}s`) as keyof DynamicDbData;
                        const sourceDataArray = dbData[sourceKey] as Array<{ id: string; name: string }> | undefined;
                        const selectedItem = sourceDataArray?.find(item => item.id === formValue);
                        displayValue = selectedItem ? selectedItem.name : `[ID: ${formValue}?]`;
                    }

                     if (formFieldKey === 'date' && displayValue) {
                        try { displayValue = new Date(displayValue + 'T00:00:00').toLocaleDateString('az-AZ', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) {}
                    }

                    return (
                        <span key={index} className="bg-yellow-100 text-yellow-900 px-1 py-0.5 rounded font-medium text-xs mx-0.5 align-baseline">
                            {displayValue || `[${formFieldKey} boşdur]`}
                        </span>
                    );
                } else {
                     if (fieldId === 'signature' || fieldId === 'stamp') {
                         return null;
                     }
                    return <span key={index} className="text-red-500 font-bold text-xs mx-0.5" title={`Tanınmayan yer tutucu: ${part}`}>[{fieldId}??]</span>;
                }
            }
            const lines = part.split('\n');
            return lines.map((line, lineIndex) => (
                <React.Fragment key={`${index}-${lineIndex}`}>{line}{lineIndex < lines.length - 1 && <br />}</React.Fragment>
            ));
        });
    }, [formData, dbData]);


    if (!template) {
        return <div className="flex items-center justify-center h-full text-gray-500">Template data is missing for preview.</div>;
    }

    const renderSection = (sectionId: string, className: string = '') => {
        const section = template.sections.find(s => s.id === sectionId);
        if (!section) return null;
        const contentNode = renderContentWithPlaceholders(section.content);
        return <div className={`${className} whitespace-pre-line leading-relaxed`}>{contentNode}</div>;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-700">Letter Preview</h3>
                 {/* Save Button Removed for Review Page */}
            </div>
            <div className="relative bg-white p-8 pr-12 pl-12 rounded-lg shadow border border-gray-200 min-h-[800px] text-sm font-serif leading-relaxed">

                 <div className="flex justify-between items-start mb-8">
                     <div className="w-24 h-16 flex items-center justify-center bg-gray-100 rounded border flex-shrink-0 overflow-hidden">
                         {formData.logoUrl ? ( <AntImage src={formData.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" /> ) : ( <span className="text-gray-400 text-xs">Loqo</span> )}
                     </div>
                     <div className="text-right space-y-1 ml-4">
                         {renderSection('header')}
                         {renderSection('date-value')}
                     </div>
                 </div>
                 {renderSection('address', 'mb-6 space-y-1')}
                 {renderSection('doc-type-value', 'mb-6')}
                 <div className="mb-6 space-y-1">
                     {template.sections.find(s => s.id === 'recipient-label' || s.id === 'recipient-value') && ( <div className="flex items-baseline"><span className="w-20 font-medium flex-shrink-0">{renderSection('recipient-label', 'inline-block')}</span>{renderSection('recipient-value')}</div> )}
                     {renderSection('recipient')}
                 </div>
                 {renderSection('introduction', 'mb-6')}
                 <div className="space-y-2 mb-8 border-t border-b border-gray-200 py-4">
                     {template.sections.find(s => s.id === 'invoice-number-label' || s.id === 'invoice-number-value') && ( <div className="flex justify-between items-baseline">{renderSection('invoice-number-label', 'inline-block font-semibold')}{renderSection('invoice-number-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'cargo-name-label' || s.id === 'cargo-name-value') && ( <div className="flex justify-between items-baseline">{renderSection('cargo-name-label', 'inline-block font-semibold')}{renderSection('cargo-name-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'cargo-description-label' || s.id === 'cargo-description-value') && ( <div className="flex justify-between items-baseline">{renderSection('cargo-description-label', 'inline-block font-semibold mr-2')}{renderSection('cargo-description-value', 'flex-grow text-right')}</div> )}
                     {template.sections.find(s => s.id === 'subcontractor-label' || s.id === 'subcontractor-value') && ( <div className="flex justify-between items-baseline">{renderSection('subcontractor-label', 'inline-block font-semibold')}{renderSection('subcontractor-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'subcontract-num-label' || s.id === 'subcontract-num-value') && ( <div className="flex justify-between items-baseline">{renderSection('subcontract-num-label', 'inline-block font-semibold')}{renderSection('subcontract-num-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'customs-value-label' || s.id === 'amount-value') && ( <div className="flex justify-between items-baseline">{renderSection('customs-value-label', 'inline-block font-semibold mr-2')}{renderSection('amount-value', 'text-right')}</div> )}
                 </div>
                 <div className="mt-12 mb-32">
                    {renderSection('footer')}
                 </div>

                 <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end h-24">
                    <div className="w-1/2 text-left flex flex-col justify-end">
                          <div className="mb-1">
                             {renderSection('signature')}
                         </div>
                         {formData.signatureUrl && (
                             <div className="h-16">
                                <AntImage
                                    src={formData.signatureUrl}
                                    alt="Signature Preview"
                                    className="max-h-full max-w-[200px] object-contain"
                                    preview={false}
                                />
                             </div>
                         )}
                    </div>

                    <div className="w-1/2 flex justify-end items-center">
                        {formData.stampUrl && (
                            <div className="w-24 h-24 flex items-center justify-center">
                                <AntImage
                                    src={formData.stampUrl}
                                    alt="Stamp Preview"
                                    className="max-h-full max-w-full object-contain opacity-85"
                                    preview={false}
                                />
                            </div>
                        )}
                    </div>
                 </div>

            </div>
        </div>
    );
}


export default function LetterReviewPage() {
    const router = useRouter();
    const params = useParams();
    const letterId = params?.letterId as string | undefined;

    const [letterDetails, setLetterDetails] = useState<LetterDetailsApiResponse | null>(null);
    const [allReferences, setAllReferences] = useState<Reference[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

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
                const [detailsResponse, refsResponse] = await Promise.all([
                    getLetterById(letterId),
                    getReferences()
                ]);

                if (!detailsResponse) {
                    throw new Error('Letter not found or you do not have permission to view it.');
                }
                if (!detailsResponse.template) {
                    throw new Error('This letter review page currently only supports letters created from templates.');
                }

                setLetterDetails(detailsResponse);
                setAllReferences(refsResponse || []);

            } catch (err: any) {
                console.error("Error fetching letter details or references:", err);
                 let errorMsg = "An error occurred while loading the letter.";
                 if (axios.isAxiosError(err) && err.response?.data?.error) {
                    errorMsg = err.response.data.error;
                 } else if (err.message) {
                    errorMsg = err.message;
                 }
                setError(errorMsg);
                setLetterDetails(null);
                setAllReferences([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [letterId]);

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

        const defaultFormData: FormData = {
             company: '', date: '', customs: '', person: '', vendor: '', contract: '', value: '', mode: '', reference: '', invoiceNumber: '', cargoName: '', cargoDescription: '', documentType: '', importPurpose: '', requestPerson: '', requestDepartment: '', declarationNumber: '', quantityBillNumber: '', subContractorName: '', subContractNumber: '', logoUrl: null, signatureUrl: null, stampUrl: null
        };

        return {
            ...defaultFormData,
            ...letterDetails.formData,
            logoUrl: letterDetails.logoUrl,
            signatureUrl: letterDetails.signatureUrl,
            stampUrl: letterDetails.stampUrl,
        };
    }, [letterDetails]);

    const handleApprove = async () => {
        if (!letterId) return;
        setIsActionLoading(true);
        message.loading({ content: 'Approving letter...', key: 'approveAction' });
        console.log(`Approving letter ${letterId}`);
        // TODO: Implement API call: await approveLetterReview(letterId);
        try {
             await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
             message.success({ content: 'Letter review approved!', key: 'approveAction', duration: 2 });
             // Consider fetching updated details or navigating back
             router.push('/dashboard/Inbox');
        } catch (apiError: any) {
             message.error({ content: `Failed to approve: ${apiError.message || 'Unknown error'}`, key: 'approveAction', duration: 3 });
        } finally {
             setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!letterId) return;
        setIsActionLoading(true);
         message.loading({ content: 'Rejecting letter...', key: 'rejectAction' });
        console.log(`Rejecting letter ${letterId}`);
         // TODO: Implement API call: await rejectLetterReview(letterId, { reason: '...' });
        try {
             await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
             message.success({ content: 'Letter review rejected!', key: 'rejectAction', duration: 2 });
             // Consider fetching updated details or navigating back
              router.push('/dashboard/Inbox');
        } catch (apiError: any) {
             message.error({ content: `Failed to reject: ${apiError.message || 'Unknown error'}`, key: 'rejectAction', duration: 3 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const renderLetterContent = () => {
        if (isLoading) {
            return <div className="text-center p-20"><Spin size="large" tip="Loading Letter Details..." /></div>;
        }

        if (error) {
            return <Alert message="Error Loading Letter" description={error} type="error" showIcon closable onClose={() => setError(null)} />;
        }

        if (!letterDetails || !letterDetails.template || !fullFormDataForPreview) {
            return <Alert message="Incomplete Data" description="Could not load all necessary letter details or template." type="warning" showIcon />;
        }

        return (
            <LetterPreviewPanelReview
                template={letterDetails.template}
                formData={fullFormDataForPreview}
                dbData={dbData}
            />
        );
    };

     const submitterName = useMemo(() => {
        if (!letterDetails?.user) return 'Unknown Submitter';
        return `${letterDetails.user.firstName || ''} ${letterDetails.user.lastName || ''}`.trim() || letterDetails.user.email;
     }, [letterDetails]);

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-lg shadow">
                 <div className="flex items-center">
                     <Button
                         icon={<ArrowLeftOutlined />}
                         onClick={() => router.back()}
                         type="text"
                         aria-label="Go back"
                         className="mr-2"
                     />
                    <Title level={3} className="mb-0 truncate">
                         Letter Review: {letterDetails?.name || (letterId ? `ID ${letterId.substring(0, 8)}...` : '')}
                     </Title>
                 </div>
                 {letterDetails && !isLoading && !error && letterDetails.status === 'pending_review' && (
                     <div className="flex space-x-2">
                        <Button
                            danger
                            icon={<CloseOutlined />}
                            onClick={handleReject}
                            loading={isActionLoading}
                            disabled={isActionLoading}
                        >
                            Reject
                        </Button>
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleApprove}
                            loading={isActionLoading}
                            disabled={isActionLoading}
                        >
                            Approve
                        </Button>
                     </div>
                 )}
            </div>

            {!isLoading && letterDetails && (
                <div className="mb-4 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                    Submitted by: <span className="font-semibold">{submitterName}</span> on <span className="font-semibold">{new Date(letterDetails.createdAt).toLocaleDateString('en-CA', { dateStyle: 'long' })}</span>
                     <span className="ml-4 pl-4 border-l border-gray-300">Status: <Tag>{letterDetails.status}</Tag></span>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
                {renderLetterContent()}
            </div>
        </div>
    );
}
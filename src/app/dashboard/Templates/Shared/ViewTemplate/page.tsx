'use client';

import React, { useState, useEffect, useMemo, Fragment, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_URL } from '@/app/config'; // Adjust path if needed
import { message, Spin, Card, Typography, Button, Alert, Tag, Divider, Avatar } from 'antd'; // Removed unused imports like Modal, Select, Input, Empty, Tooltip, Checkbox
import { LeftOutlined } from '@ant-design/icons'; // Removed unused icons
import axios from 'axios';
import dayjs from 'dayjs'; // Import dayjs if needed for date formatting, otherwise remove

// Interfaces
interface TemplateSectionData {
    id: string;
    title: string;
    content: string;
}

interface TemplateData {
    id: string;
    name?: string | null;
    sections: TemplateSectionData[];
    userId: string; // Creator ID
    createdAt: string;
    updatedAt: string;
}

interface TemplateField {
    id: string;
    type: string;
    label: string;
}

// Constants
const fieldMappings = [
    { formField: 'company', templateField: 'company-1', type: 'dropdown', source: 'companies' },
    { formField: 'date', templateField: 'date-1', type: 'date' },
    { formField: 'customs', templateField: 'customs-1', type: 'dropdown', source: 'customs' },
    { formField: 'vendor', templateField: 'vendor-1', type: 'dropdown', source: 'vendors' },
    { formField: 'contract', templateField: 'contract-1', type: 'dropdown', source: 'contracts' },
    { formField: 'value', templateField: 'amount-1', type: 'number' },
    { formField: 'invoiceNumber', templateField: 'invoice-number', type: 'text' },
    { formField: 'cargoName', templateField: 'cargo-name', type: 'text' },
    { formField: 'cargoDescription', templateField: 'cargo-description', type: 'text' },
    { formField: 'documentType', templateField: 'document-type', type: 'dropdown', source: 'documentTypes' },
    { formField: 'importPurpose', templateField: 'import-purpose', type: 'text' },
    { formField: 'requestPerson', templateField: 'request-person', type: 'text' },
    { formField: 'requestDepartment', templateField: 'request-department', type: 'text' },
    { formField: 'person', templateField: 'person', type: 'text' },
    { formField: 'subContractorName', templateField: 'subcontractor-name', type: 'dropdown', source: 'subContractorNames' },
    { formField: 'subContractNumber', templateField: 'subcontract-number', type: 'text' },
];

const templateFields: TemplateField[] = fieldMappings.map(mapping => ({
    id: mapping.templateField,
    type: mapping.type,
    label: mapping.formField.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
}));

// API Functions
const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token_w') : null;
    if (!token) return undefined;
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
    };
};



async function fetchSharedTemplateById(templateId: string): Promise<TemplateData> {
    const config = getAuthHeaders();
    if (!config) throw new Error('Autentifikasiya tələb olunur.');
    const response = await axios.get(`${API_URL}/templates/${templateId}/shared`, config);
    return response.data;
}

// Simplified Component for Viewing Shared Templates
function ViewSharedTemplateContent() {
    const [templateData, setTemplateData] = useState<TemplateData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const templateId = searchParams.get('templateId');

    useEffect(() => {
        setTemplateData(null);
        setError(null);
        setIsLoading(true);

        if (templateId) {
            const loadData = async () => {
                try {
                    const fetchedTemplate = await fetchSharedTemplateById(templateId);
                    setTemplateData(fetchedTemplate);
                } catch (err: any) {
                    console.error("Error loading shared template data:", err);
                    let specificError = 'Şablon yüklənərkən xəta baş verdi.';
                     if (err.response?.status === 404) {
                         specificError = 'Bu şablon tapılmadı.';
                     } else if (err.response?.status === 403) {
                         specificError = 'Bu şablona baxmaq üçün icazəniz yoxdur.';
                     } else {
                        specificError = err.response?.data?.error || err.message || specificError;
                     }
                    setError(specificError);
                    message.error(specificError);
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        } else {
             const msg = "URL-də şablon ID-si tapılmadı.";
             setError(msg);
             setIsLoading(false);
             message.warning(msg);
        }
    }, [templateId]);

    const renderContentWithLabels = (text: string): React.ReactNode => {
        if (!text) return '';
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part, index) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1);
                const field = templateFields.find(f => f.id === fieldId);
                if (field) {
                    return (
                        <Tag color="processing" key={index} className="mx-0.5 text-xs font-sans">
                            [{field.label}]
                        </Tag>
                    );
                } else {
                    return <Tag color="error" key={index} className="mx-0.5 text-xs font-sans">[{fieldId}?]</Tag>;
                }
            }
             const lines = part.split('\n');
             return lines.map((line, lineIndex) => (
                  <Fragment key={`${index}-${lineIndex}`}>
                     {line}
                     {lineIndex < lines.length - 1 && <br />}
                  </Fragment>
             ));
        });
    };

    const renderReadOnlySection = (sectionId: string, className: string = '', defaultText: string = '') => {
        if (!templateData) return <span className={`text-gray-400 text-xs ${className}`}>[Yüklənir...]</span>;
        const section = templateData.sections.find(s => s.id === sectionId);
        if (section && section.content) {
            return (<div className={`${className} min-h-[1em]`}>{renderContentWithLabels(section.content)}</div>);
        } else if (section && (!section.content || section.content.trim() === '')) {
             return <span className={`text-gray-400 text-xs ${className}`}>[Boş]</span>;
        } else {
            return <span className={`text-orange-400 text-xs italic ${className}`}>[{defaultText || `Bölmə (${sectionId}) render edilə bilmədi`}]</span>;
         }
    };

    if (isLoading) {
       return ( <div className="flex justify-center items-center min-h-[400px] p-8"> <Spin size="large" tip="Şablon yüklənir..." /> </div> );
    }

    if (error && !templateData) {
       return ( <div className="p-4 md:p-8"> <Alert message="Xəta" description={error} type="error" showIcon action={<Button type="primary" onClick={() => router.push('/dashboard/Templates/Shared')}>Paylaşılanlar Siyahısına Qayıt</Button>} /> </div> );
    }

    if (!templateData) {
        return ( <div className="p-4 md:p-8"> <Alert message="Məlumat Tapılmadı" description={"Şablon ID-si tapılmadı və ya göstərilən ID ilə şablon mövcud deyil."} type="warning" showIcon action={<Button type="default" onClick={() => router.push('/dashboard/Templates/Shared')}>Paylaşılanlar Siyahısına Qayıt</Button>} /> </div> );
    }

    return (
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
            <Card bordered={false} className="shadow-lg rounded-lg">
                 <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b pb-4">
                     <Button icon={<LeftOutlined />} onClick={() => router.push('/dashboard/Templates/Shared')}> Paylaşılanlara Qayıt </Button>
                     <Typography.Title level={4} className="mb-0 text-center flex-grow px-4 truncate" title={templateData.name || "Adsız Şablon"}> {templateData.name || "Adsız Şablon"} </Typography.Title>
                     <div style={{ width: 'auto', minWidth:'88px' }}></div> {/* Placeholder to help balance title */}
                 </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 text-sm font-serif leading-relaxed shadow-inner">
                     <div className="flex justify-between items-start mb-8">
                        <div className="w-24 h-16 flex items-center justify-center bg-gray-100 rounded border flex-shrink-0 text-gray-400 text-xs">
                             <span>Loqo</span>
                        </div>
                        <div className="text-right space-y-1 ml-4">
                            {renderReadOnlySection('header', 'font-semibold')}
                            {renderReadOnlySection('date-value')}
                        </div>
                    </div>
                    <div className="mb-6 space-y-1">
                        {renderReadOnlySection('address', 'whitespace-pre-line')}
                        {renderReadOnlySection('doc-type-value')}
                    </div>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-6 text-xs space-y-1.5 font-sans">
                        <div className="flex items-baseline"><span className="w-28 font-medium flex-shrink-0">{renderReadOnlySection('request-person-label', 'inline-block')}</span>{renderReadOnlySection('request-person-value')}</div>
                        <div className="flex items-baseline"><span className="w-28 font-medium flex-shrink-0">{renderReadOnlySection('request-dept-label', 'inline-block')}</span>{renderReadOnlySection('request-dept-value')}</div>
                        <div className="flex items-baseline"><span className="w-28 font-medium flex-shrink-0">{renderReadOnlySection('import-purpose-label', 'inline-block')}</span>{renderReadOnlySection('import-purpose-value', 'flex-grow')}</div>
                    </div>
                    <div className="mb-6 space-y-1"><div className="flex items-baseline"><span className="w-20 font-medium flex-shrink-0">{renderReadOnlySection('recipient-label', 'inline-block')}</span>{renderReadOnlySection('recipient-value')}</div>{renderReadOnlySection('recipient')}</div>
                    <div className="mb-6">{renderReadOnlySection('introduction')}</div>
                    <div className="space-y-2 mb-8 border-t border-b border-gray-200 py-4 font-sans">
                        <div className="flex justify-between items-baseline">{renderReadOnlySection('invoice-number-label', 'inline-block font-semibold')}{renderReadOnlySection('invoice-number-value', 'text-right')}</div>
                        <div className="flex justify-between items-baseline">{renderReadOnlySection('cargo-name-label', 'inline-block font-semibold')}{renderReadOnlySection('cargo-name-value', 'text-right')}</div>
                        <div className="flex justify-between items-baseline">{renderReadOnlySection('cargo-description-label', 'inline-block font-semibold mr-2')}{renderReadOnlySection('cargo-description-value', 'flex-grow text-right')}</div>
                         <div className="flex justify-between items-baseline">{renderReadOnlySection('subcontractor-label', 'inline-block font-semibold')}{renderReadOnlySection('subcontractor-value', 'text-right')}</div>
                         <div className="flex justify-between items-baseline">{renderReadOnlySection('subcontract-num-label', 'inline-block font-semibold')}{renderReadOnlySection('subcontract-num-value', 'text-right')}</div>
                        <div className="flex justify-between items-baseline">{renderReadOnlySection('customs-value-label', 'inline-block font-semibold mr-2')}{renderReadOnlySection('amount-value', 'text-right')}</div>
                    </div>
                    <div className="mt-12">{renderReadOnlySection('footer', 'whitespace-pre-line')}</div>
                    <div className="mt-8 pt-8 border-t border-dashed">{renderReadOnlySection('signature')}</div>
                </div>
            </Card>
        </div>
    );
}

// Default Export
export default function ViewSharedTemplatePage() {
    return (
        <Suspense fallback={ <div className="flex justify-center items-center min-h-screen p-8"> <Spin size="large" tip="Səhifə yüklənir..." /> </div> }>
            <ViewSharedTemplateContent />
        </Suspense>
    );
}
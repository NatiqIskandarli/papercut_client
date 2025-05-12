'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_URL } from '@/app/config';
import { message, Spin, Card, Typography, Button, Alert } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import axios from 'axios';
import CkeditorOzel from '../../../CreateLetter/ckeditor_letter';

interface TemplateData {
    id: string;
    name?: string | null;
    content: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

interface TemplateField {
    id: string;
    type: string;
    label: string;
}

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

const getAuthHeaders = () => {
    return {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        withCredentials: true,
    };
};

async function fetchSharedTemplateById(templateId: string): Promise<TemplateData> {
    const config = getAuthHeaders();
    const response = await axios.get(`${API_URL}/templates/${templateId}/shared`, config);
    return response.data;
}

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

    const renderContentWithLabels = (text: string): string => {
        if (!text) return '';
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1);
                const field = templateFields.find(f => f.id === fieldId);
                if (field) {
                    return `<span class="ant-tag ant-tag-processing mx-0.5 text-xs font-sans">[${field.label}]</span>`;
                } else {
                    return `<span class="ant-tag ant-tag-error mx-0.5 text-xs font-sans">[${fieldId}?]</span>`;
                }
            }
            return part.replace(/\n/g, '<br/>');
        }).join('');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[400px] p-8">
                <Spin size="large" tip="Şablon yüklənir..." />
            </div>
        );
    }

    if (error && !templateData) {
        return (
            <div className="p-4 md:p-8">
                <Alert
                    message="Xəta"
                    description={error}
                    type="error"
                    showIcon
                    action={<Button type="primary" onClick={() => router.push('/dashboard/Templates/Shared')}>Paylaşılanlar Siyahısına Qayıt</Button>}
                />
            </div>
        );
    }

    if (!templateData) {
        return (
            <div className="p-4 md:p-8">
                <Alert
                    message="Məlumat Tapılmadı"
                    description={"Şablon ID-si tapılmadı və ya göstərilən ID ilə şablon mövcud deyil."}
                    type="warning"
                    showIcon
                    action={<Button type="default" onClick={() => router.push('/dashboard/Templates/Shared')}>Paylaşılanlar Siyahısına Qayıt</Button>}
                />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
            <Card bordered={false} className="shadow-lg rounded-lg">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b pb-4">
                    <Button icon={<LeftOutlined />} onClick={() => router.push('/dashboard/Templates/Shared')}> Paylaşılanlara Qayıt </Button>
                    <Typography.Title level={4} className="mb-0 text-center flex-grow px-4 truncate" title={templateData.name || "Adsız Şablon"}> {templateData.name || "Adsız Şablon"} </Typography.Title>
                    <div style={{ width: 'auto', minWidth:'88px' }}></div> {/* Placeholder to help balance title */}
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 text-sm font-serif leading-relaxed shadow-inner">
                    {/* <div dangerouslySetInnerHTML={{ __html: renderContentWithLabels(templateData.content) }} /> */}
                    <div className="ck-editor-wrapper">
                                        <CkeditorOzel
                                            onChange={() => {}}
                                            initialData={templateData.content}
                                            customFields={[]}
                                            readOnly={true}
                                        />
                                        </div>
                </div>
            </Card>
        </div>
    );
}

export default function ViewSharedTemplatePage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen p-8"><Spin size="large" tip="Səhifə yüklənir..." /></div>}>
            <ViewSharedTemplateContent />
        </Suspense>
    );
}
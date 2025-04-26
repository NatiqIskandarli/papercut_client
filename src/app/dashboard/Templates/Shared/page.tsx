'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/app/config';
import { message, Spin, List, Card, Typography, Button, Empty, Alert } from 'antd';
import dayjs from 'dayjs';

interface SharedTemplateData {
    id: string;
    name?: string | null;
    sections: Array<{ id: string; title: string; content: string }>;
    userId: string;
    createdAt: string;
    updatedAt: string;
    creator?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
    };
}

async function fetchSharedTemplates(): Promise<SharedTemplateData[]> {
    const res = await fetch(`${API_URL}/templates/shared-with-me`, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        console.error("API Error fetching shared templates:", res.status, errorData);
        if (res.status === 401) { throw new Error('İcazəniz yoxdur və ya sessiyanız bitib. Zəhmət olmasa, yenidən daxil olun.'); }
        throw new Error(`Paylaşılan şablonları çəkərkən xəta baş verdi: ${errorData.message || res.statusText} (Status: ${res.status})`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) { throw new Error('Serverdən yanlış məlumat formatı alındı.'); }
    return data as SharedTemplateData[];
}

export default function SharedTemplatesPage() {
    const [templates, setTemplates] = useState<SharedTemplateData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const loadTemplates = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedTemplates = await fetchSharedTemplates();
                fetchedTemplates.sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());
                setTemplates(fetchedTemplates);
            } catch (err: any) {
                console.error("Error fetching shared templates:", err);
                const errorMessage = err.message || 'Paylaşılan şablonları yükləyərkən naməlum xəta baş verdi.';
                setError(errorMessage);
                message.error(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        loadTemplates();
    }, []);

    const handleTemplateClick = (templateId: string) => {
        router.push(`/dashboard/Templates/Shared/ViewTemplate?templateId=${templateId}`);
    };

    const renderTemplateItem = (template: SharedTemplateData) => {
        const creatorName = template.creator
         ? `${template.creator.firstName || ''} ${template.creator.lastName || ''}`.trim() || 'Naməlum'
         : 'Naməlum';

        return (
            <List.Item
                key={template.id}
                actions={[
                    <Button type="link" onClick={(e) => { e.stopPropagation(); handleTemplateClick(template.id); }}>
                        Bax
                    </Button>
                ]}
                className="hover:bg-gray-50 transition-colors cursor-pointer rounded-md px-4 py-3"
                onClick={() => handleTemplateClick(template.id)}
            >
                <List.Item.Meta
                    title={<Typography.Text className="font-medium">{template.name || `Adsız Şablon (ID: ${template.id.substring(0, 8)}...)`}</Typography.Text>}
                    description={
                        <span>
                             Yaradan: {creatorName} &nbsp;&nbsp; | &nbsp;&nbsp; Son yenilənmə: {dayjs(template.updatedAt).format('DD/MM/YYYY HH:mm')}
                         </span>
                      }
                />
                 <div className="text-xs text-gray-500 mr-4">
                    {template.sections.length} bölmə
                 </div>
            </List.Item>
        );
     };

    return (
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
            <Card bordered={false} className="shadow-lg rounded-lg">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <Typography.Title level={2} className="mb-0">
                        Mənimlə Paylaşılan Şablonlar
                    </Typography.Title>
                </div>

                {isLoading && (
                    <div className="text-center py-10">
                        <Spin size="large" tip="Şablonlar yüklənir..." />
                    </div>
                )}

                {error && !isLoading && (
                    <Alert
                      message="Xəta"
                      description={error}
                      type="error"
                      showIcon
                      className="mb-4"
                    />
                )}

                {!isLoading && !error && templates.length === 0 && (
                   <div className="text-center py-10">
                       <Empty description={
                           <span>
                                Sizinlə heç bir şablon paylaşılmayıb.
                           </span>
                       } />
                   </div>
                )}

                {!isLoading && !error && templates.length > 0 && (
                    <List
                        itemLayout="horizontal"
                        dataSource={templates}
                        renderItem={renderTemplateItem}
                        bordered
                        className="bg-white rounded-md"
                    />
                )}
            </Card>
        </div>
    );
}
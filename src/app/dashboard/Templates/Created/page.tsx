'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/app/config'; // Config faylınızın yolu
import { message, Spin, List, Card, Typography, Button, Empty, Alert } from 'antd'; // Ant Design komponentləri

// Backend-dən gələn şablon məlumatlarının interfeysi
interface TemplateData {
    id: string;
    name?: string | null;
    content: string; // HTML məzmunu
    userId: string;
    createdAt: string; // ISO formatında tarix gözlənilir
    updatedAt: string; // ISO formatında tarix gözlənilir
}

// API funksiyası (lazım gələrsə utils/api.ts faylına çıxarıla bilər)
async function fetchUserTemplates(): Promise<TemplateData[]> {
    const res = await fetch(`${API_URL}/templates`, { // GET /api/templates endpointinə sorğu göndəririk
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Authentication üçün credentials: 'include' istifadə edirik
     });

    if (!res.ok) {
        // Xəta hallarını idarə edirik
        const errorData = await res.json().catch(() => ({ message: res.statusText })); // Xəta mesajını JSON-dan almağa çalışırıq
        console.error("API Error:", res.status, errorData);
        if (res.status === 401) {
             throw new Error('İcazəniz yoxdur və ya sessiyanız bitib. Zəhmət olmasa, yenidən daxil olun.');
        }
        throw new Error(`Şablonları çəkərkən xəta baş verdi: ${errorData.message || res.statusText} (Status: ${res.status})`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
        console.error("Invalid data format:", data);
        throw new Error('Serverdən yanlış məlumat formatı alındı.');
    }
    return data as TemplateData[];
}


export default function CreatedTemplatesPage() {
    const [templates, setTemplates] = useState<TemplateData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Şablonları çəkmək üçün useEffect
    useEffect(() => {
        const loadTemplates = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedTemplates = await fetchUserTemplates();
                // Ən son yenilənənləri yuxarıda göstərmək üçün sıralayaq
                fetchedTemplates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                setTemplates(fetchedTemplates);
            } catch (err: any) {
                console.error("Error fetching templates:", err);
                const errorMessage = err.message || 'Şablonları yükləyərkən naməlum xəta baş verdi.';
                setError(errorMessage);
                message.error(errorMessage); // İstifadəçiyə bildiriş göstər
            } finally {
                setIsLoading(false);
            }
        };

        loadTemplates();
    }, []); // Yalnız komponent ilk dəfə render olduqda işə düşür

    // Şablona kliklədikdə işə düşəcək funksiya
    const handleTemplateClick = (templateId: string) => {
        router.push(`/dashboard/Templates/Created/ViewTemplate?templateId=${templateId}`);
    };

    // Hər bir şablon elementini render edən funksiya
    const renderTemplateItem = (template: TemplateData) => (
        <List.Item
            key={template.id}
            actions={[ // Hər elementin sağında görünəcək düymə(lər)
                <Button type="link" onClick={(e) => { e.stopPropagation(); handleTemplateClick(template.id); }}>
                    View
                </Button>
                // Gələcəkdə silmə və ya kopyalama düymələri əlavə etmək olar
            ]}
            className="hover:bg-gray-50 transition-colors cursor-pointer rounded-md px-4 py-3"
            onClick={() => handleTemplateClick(template.id)} // Bütün elementə klikləmək imkanı
        >
            <List.Item.Meta
                title={<Typography.Text className="font-medium">{template.name || `Adsız Şablon (ID: ${template.id.substring(0, 8)}...)`}</Typography.Text>}
                description={`Son yenilənmə: ${new Date(template.updatedAt).toLocaleString('az-AZ')}`} // Lokal tarix formatı
            />
        </List.Item>
    );

    return (
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
            <Card bordered={false} className="shadow-lg rounded-lg">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <Typography.Title level={2} className="mb-0">
                        Yaratdığım Şablonlar
                    </Typography.Title>
                     <Button
                        type="primary"
                        onClick={() => router.push('/dashboard/CreateForm')}
                        size="large"
                    >
                        + Yeni Şablon Yarat
                    </Button>
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
                                Heç bir şablon yaradılmayıb. <br />
                                <Button type="link" onClick={() => router.push('/dashboard/CreateForm')}>
                                     İndi birini yaradın!
                                 </Button>
                           </span>
                       } />
                   </div>
                )}

                {!isLoading && !error && templates.length > 0 && (
                    <List
                        itemLayout="horizontal"
                        dataSource={templates}
                        renderItem={renderTemplateItem}
                        bordered // Elementlər arası xətt
                        className="bg-white rounded-md"
                    />
                )}
            </Card>
        </div>
    );
}
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Select, message, Spin, Button } from 'antd';
import { getTemplateDetailsForUser, fetchSharedTemplates } from '@/utils/api';
import axios from 'axios';
import { API_URL } from '@/app/config';
import { usePathname } from 'next/navigation';
//import './editor_ozel.css';
import CkeditorOzel from './ckeditor_letter';


// Assuming these interfaces are defined in your api.ts or elsewhere
interface CustomField {
  id: string;
  name: string;
  type: string;
  initialValue: string;
  placeholder: string;
}

interface FormData {
  [key: string]: string;
}

interface SavedTemplate {
  id: string;
  name?: string | null;
  content?: string; // Optional
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface SharedTemplateData {
  id: string;
  name?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatar?: string | null;
  };
}

// Placeholder extraction function
const extractPlaceholders = (text: string): string[] => {
  const regex = /#([a-zA-Z0-9-]+)#/g;
  const placeholders = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    placeholders.add(match[1]);
  }
  return Array.from(placeholders);
};

// LetterFormPanel Component
function LetterFormPanel({
  formData,
  setFormData,
  customFields,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  customFields: CustomField[];
}) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Məktub Məlumatları</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1">
        {customFields.map(field => (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-0.5">
              {field.name}
            </label>
            <input
              type="text"
              name={field.id}
              value={formData[field.id] || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// LetterPreviewPanel Component
function LetterPreviewPanel({
  template,
  formData,
  onSaveLetter,
  isSaving,
  letterName,
  setLetterName,
}: {
  template: SavedTemplate | null;
  formData: FormData;
  onSaveLetter: () => void;
  isSaving: boolean;
  letterName: string;
  setLetterName: React.Dispatch<React.SetStateAction<string>>;
}) {
    const [processedContent, setProcessedContent] = useState<string>('');

  useEffect(() => {
    if (template?.content) {
      const renderedContent = renderContentWithPlaceholders(template.content);
      setProcessedContent(renderedContent);
    }
  }, [template, formData]);

  // Placeholder-ləri formData ilə əvəz et
  const renderContentWithPlaceholders = (text: string): string => {
    if (!text) return '';
    return text.replace(/#([a-zA-Z0-9-]+)#/g, (match, p1) => {
      return formData[p1] || `[${p1} boşdur]`; // Əgər dəyər yoxdursa placeholder göstər
    });
  };

  if (!template || !template.content) {
    return <div className="flex items-center justify-center h-full text-gray-500">Məktub önizləməsi üçün şablon seçin və ya məzmun yoxdur.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">Məktub Önizləməsi</h3>
        <Button type="primary" onClick={onSaveLetter} loading={isSaving} disabled={!template || isSaving}>
          Məktubu Yadda Saxla
        </Button>
      </div>
      
      <div className="mb-4">
        <label htmlFor="letterName" className="block text-sm font-medium text-gray-700 mb-1">
          Məktubun adı
        </label>
        <input
          id="letterName"
          type="text"
          value={letterName}
          onChange={(e) => setLetterName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          placeholder="Məktubun adını daxil edin"
        />
      </div>

      {/* <div className="letter-preview-scroll" style={{ maxHeight: '800px', overflowY: 'auto' }}>
        <div className="letter-preview-container letter-content ck-content" 
          dangerouslySetInnerHTML={{ __html: processedContent }} />
      </div> */}


      <div className="document-editor">
        
        <CkeditorOzel
          onChange={() => {}}
          initialData={processedContent}
          customFields={[]} 
          readOnly={true}
        />
      </div>



      
    </div>
  );
}

// Main Page Component
export default function CreateLetterPage() {
  const [sharedTemplates, setSharedTemplates] = useState<SharedTemplateData[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingTemplateDetails, setIsLoadingTemplateDetails] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isSavingLetter, setIsSavingLetter] = useState(false);
  const [letterName, setLetterName] = useState('');
  const pathname = usePathname();
  const isCreateLetterPage = pathname && pathname.includes('CreateLetter');

  useEffect(() => {
    const fetchSharedTemplatesData = async () => {
      setIsLoadingTemplates(true);
      setTemplateError(null);
      try {
        const sharedTpls = await fetchSharedTemplates(); // Returns SharedTemplateData[]
        console.log("Shared templates fetched:", sharedTpls);
        setSharedTemplates(sharedTpls || []);
      } catch (err: any) {
        const msg = err.message || 'Şablonları yükləyərkən ümumi xəta.';
        console.error("Template fetch error:", err);
        setTemplateError(msg);
        message.error(msg);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    fetchSharedTemplatesData();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplate(null);
      return;
    }
    const fetchDetails = async () => {
      setIsLoadingTemplateDetails(true);
      setTemplateError(null);
      try {
        const details = await getTemplateDetailsForUser(selectedTemplateId); // Returns SavedTemplate
        console.log("Template details fetched:", details);
        setSelectedTemplate(details); // No type error now
        if (details.content) {
          const placeholders = extractPlaceholders(details.content);

          console.log("Extracted placeholders:", placeholders);
          const fields = placeholders.map(placeholder => ({
            id: placeholder,
            name: placeholder.replace(/-/g, ' ').toUpperCase(),
            type: 'text',
            initialValue: '',
            placeholder: `#${placeholder}#`
          }));
          setCustomFields(fields);
        } else {
          setCustomFields([]);
        }
        setFormData({});
      } catch (err: any) {
        const msg = err.message || 'Şablon detallarını yükləyərkən xəta.';
        console.error("Template details fetch error:", err);
        setTemplateError(msg);
        message.error(msg);
      } finally {
        setIsLoadingTemplateDetails(false);
      }
    };
    fetchDetails();
  }, [selectedTemplateId]);

  const templateOptions = useMemo(() => {
    return sharedTemplates.map(tpl => {
      const creatorName = tpl.creator ? `${tpl.creator.firstName || ''} ${tpl.creator.lastName || ''}`.trim() : null;
      let label = tpl.name || `Adsız Şablon ${tpl.id.substring(0, 6)}...`;
      if (creatorName) {
        label += ` (Paylaşan: ${creatorName})`;
      } else {
        label += ` (Paylaşılıb)`;
      }
      return { label, value: tpl.id };
    });
  }, [sharedTemplates]);

  const handleSaveLetter = async () => {
    if (!selectedTemplate || !selectedTemplateId) {
      message.error("Məktubu yadda saxlamazdan əvvəl şablon seçin.");
      return;
    }

    if (!letterName.trim()) {
      message.warning("Zəhmət olmasa, məktubun adını daxil edin.");
      return;
    }

    const missingFields = customFields.filter(field => !formData[field.id] || formData[field.id].trim() === '');
    if (missingFields.length > 0) {
      message.warning(`Zəhmət olmasa, tələb olunan sahələri doldurun: ${missingFields.map(f => f.name).join(', ')}`);
      return;
    }

    setIsSavingLetter(true);
    message.loading({ content: 'Məktub yadda saxlanılır...', key: 'savingLetter' });
    try {
      const letterPayload = {
        templateId: selectedTemplateId,
        formData: formData,
        name: letterName.trim()
      };
      const savedLetterData = await saveLetter(letterPayload);
      message.success({ content: `Məktub (ID: ${savedLetterData.id}) uğurla yadda saxlandı!`, key: 'savingLetter', duration: 3 });
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setFormData({});
      setLetterName('');
    } catch (error: any) {
      console.error("Error saving letter:", error);
      let errorMsg = 'Məktubu yadda saxlayarkən naməlum xəta baş verdi.';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message) {
        errorMsg = error.message;
      }
      message.error({ content: `Məktubu yadda saxlayarkən xəta: ${errorMsg}`, key: 'savingLetter', duration: 5 });
    } finally {
      setIsSavingLetter(false);
    }
  };

  return (
    <>
    <style jsx>{`
      .min-h-screen{
        min-height:  ${isCreateLetterPage ? 'auto !important' : '100vh'};
      }
    `}</style>
    


    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      {/* Template Selection */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Məktub Yarat</h2>
        <label htmlFor="templateSelect" className="block text-sm font-medium text-gray-700 mb-1">Əsas Şablonu Seçin</label>
        <Select
          id="templateSelect"
          style={{ width: '100%' }}
          placeholder="Şablon seçin..."
          loading={isLoadingTemplates}
          value={selectedTemplateId}
          onChange={(value) => setSelectedTemplateId(value)}
          disabled={isLoadingTemplates || isLoadingTemplateDetails}
          showSearch
          optionFilterProp="label"
          options={templateOptions}
        />
        {templateError && <p className="text-red-500 text-xs mt-1">{templateError}</p>}
        {isLoadingTemplateDetails && <div className="mt-2 text-center"><Spin size="small" /> Şablon yüklənir...</div>}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-template-columns lg:gap-8" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Form Panel */}
        <div className={`bg-white rounded-lg shadow-md p-6 transition-opacity duration-300 ${!selectedTemplateId || isLoadingTemplateDetails ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {selectedTemplateId && !isLoadingTemplateDetails && selectedTemplate ? (
            <LetterFormPanel
              formData={formData}
              setFormData={setFormData}
              customFields={customFields}
            />
          ) : (
            <div className="text-center text-gray-500 py-10">
              {isLoadingTemplates ? 'Şablonlar yüklənir...' : 'Məlumatları daxil etmək üçün yuxarıdan şablon seçin.'}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <LetterPreviewPanel
            template={selectedTemplate}
            formData={formData}
            onSaveLetter={handleSaveLetter}
            isSaving={isSavingLetter}
            letterName={letterName}
            setLetterName={setLetterName}
          />
        </div>
      </div>
    </div>
    </>
  );
}


async function saveLetter(payload: { templateId: string; formData: FormData; name: string }) {
    const response = await axios.post(`${API_URL}/letters`, payload, {
        withCredentials: true,
    });
  return response.data;
}
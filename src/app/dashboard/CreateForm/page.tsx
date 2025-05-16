'use client';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { API_URL } from '@/app/config';
import { message, Modal, Form, Input, Select, Button, List } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';
import CkeditorOzel from './ckeditor';
import { FormTemplateContext, CustomField, FormData} from '@/contexts/FormTemplateContext';


const DynamicCkeditorOzel = dynamic(() => import('./ckeditor'), {
    ssr: false, // Disable SSR for this component
});



export interface Reference {
  id: string;
  name: string;
  type: string;
}

export interface DynamicDbData {
  companies: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  contracts: Array<{ id: string; name: string }>;
  customs: Array<{ id: string; name: string }>;
  documentTypes: Array<{ id: string; name: string }>;
  subContractorNames: Array<{ id: string; name: string }>;
}





interface TemplateFormAppProps {
  children: React.ReactNode;
}

function TemplateFormApp({ children }: TemplateFormAppProps) {
  const [allReferences, setAllReferences] = useState<Reference[]>([]);
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    company: '',
    date: new Date().toISOString().split('T')[0],
    customs: '',
    person: 'H. Əliyeva',
    vendor: '',
    contract: '',
    value: '100.000',
    mode: 'vaqonlar',
    reference: 'OB/FM/0001-03.25',
    logo: '',
    invoiceNumber: '',
    cargoName: '',
    cargoDescription: 'Hesab-fakturada göstərildiyi kimi',
    documentType: '',
    importPurpose: '',
    requestPerson: '',
    requestDepartment: '',
    declarationNumber: '',
    quantityBillNumber: '',
    subContractorName: '',
    subContractNumber: '',
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [templateContent, setTemplateContent] = useState<string>('');
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReferences = async () => {
      setIsLoadingReferences(true);
      setReferenceError(null);
      try {
        const res = await fetch(`${API_URL}/references`, { credentials: 'include' });
        if (!res.ok) throw new Error(`API request failed with status ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) setAllReferences(data);
        else throw new Error('Unexpected data format from API');
      } catch (err: any) {
        console.error('Error fetching references:', err);
        setReferenceError(`Failed to fetch references: ${err.message}`);
        setAllReferences([]);
      } finally {
        setIsLoadingReferences(false);
      }
    };
    fetchReferences();
  }, []);

  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const res = await fetch(`${API_URL}/placeholders`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch custom fields');
        const data = await res.json();
        console.log('Custom fields:', data);
        setCustomFields(data);
      } catch (error) {
        console.error('Error fetching custom fields:', error);
        message.error('Failed to load custom fields');
      }
    };
    fetchCustomFields();
  }, []);

  const saveDocumentChanges = async (): Promise<void> => {
    const templateName = prompt('Şablon üçün ad daxil edin (opsional):');
    if (templateName === null) {
      message.info('Şablon yadda saxlanılmadı.');
      return;
    }
    message.loading({ content: 'Şablon yadda saxlanılır...', key: 'savingTemplate' });
    // Placeholder for actual save logic
    message.success({ content: 'Şablon yadda saxlandı (backend tamamlanmayıb)!', key: 'savingTemplate', duration: 3 });
  };

  return (
    <FormTemplateContext.Provider
      value={{
        formData,
        setFormData,
        customFields,
        setCustomFields,
        templateContent,
        setTemplateContent,
        saveDocumentChanges,
        isLoadingReferences,
        referenceError,
        currentTemplateId,
        setCurrentTemplateId,
      }}
    >
      {children}
    </FormTemplateContext.Provider>
  );
}

function TemplatePanel() {
  const context = useContext(FormTemplateContext);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [templateName, setTemplateName] = useState<string>('');

  if (!context) throw new Error('TemplatePanel must be used within a FormTemplateContext Provider');

  const { customFields, setCustomFields, templateContent, setTemplateContent, saveDocumentChanges } = context;

  const showModal = () => setIsModalVisible(true);
  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleCreateField = async () => {
    try {
      const values = await form.validateFields();
      let { name, type, initialValue } = values;
      name = name.trim().replace(/\s+/g, '');
      const response = await fetch(`${API_URL}/placeholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, type, initialValue: initialValue || null }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create field');
      }
      const newField = await response.json();
      setCustomFields((prev) => [...prev, newField]);
      form.resetFields();
      message.success('Field created successfully');
    } catch (error: any) {
      console.error('Error creating field:', error);
      message.error(`Failed to create field: ${error.message}`);
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/placeholders/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete field');
      setCustomFields((prev) => prev.filter((field) => field.id !== id));
      message.success('Field deleted successfully');
    } catch (error) {
      console.error('Error deleting field:', error);
      message.error('Failed to delete field');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      message.error('Template adı boş ola bilməz.');
      return;
    }
    if (!templateContent.trim()) {
      message.error('Məzmun boş ola bilməz.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: templateName, content: templateContent }),
      });
      if (!response.ok) throw new Error('Şablon saxlanılmadı.');
      message.success('Şablon uğurla saxlandı.');
      setTemplateName('');
      setTemplateContent('');
    } catch (error: any) {
      message.error(`Xəta: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
        <h3 className="text-sm font-medium text-blue-800 mb-1">Sahələrin İstifadəsi</h3>
        <p className="text-xs text-blue-700">
          Aşağıdakı şablon önizləməsində istənilən mətn bölməsinə klikləyin. Redaktə rejimində, forma sahəsini mətnə daxil etmək üçün{' '}
          <code className="bg-blue-200 px-1 rounded text-blue-900">#</code> simvolunu yazın və açılan menyudan istədiyiniz sahəni seçin.
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold text-gray-800">Şablon Önizləməsi</h2>
        <Input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Template adı daxil edin"
          className="flex-1"
        />
      </div>

      <div className="document-editor">
        <CkeditorOzel
          onChange={(data) => setTemplateContent(data)}
          initialData={templateContent}
          customFields={customFields}
        />
      </div>

      <div className="flex justify-between items-center">
        <Button onClick={showModal} className="bg-yellow-500 text-white">
          Create Fields
        </Button>
        <Button onClick={handleSaveTemplate} className="bg-green-600 text-white">
          Şablonu Yadda Saxla
        </Button>
      </div>

      <Modal title="Create Fields" open={isModalVisible} onCancel={handleCancel} footer={null}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Field Name"
            rules={[{ required: true, message: 'Please input the field name!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="type"
            label="Field Type"
            rules={[{ required: true, message: 'Please select the field type!' }]}
          >
            <Select>
              {['Data', 'Time', 'Date and Time', 'Text', 'Dropdown', 'Number', 'Currency', 'Weight', 'Depletable Balance'].map((type) => (
                <Select.Option key={type} value={type}>{type}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="initialValue" label="Initial Value">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleCreateField}>
              Create
            </Button>
          </Form.Item>
        </Form>
        <div className="mt-4">
          <h3>Created Fields</h3>
          <List
            dataSource={customFields}
            renderItem={(field) => (
              <List.Item
                actions={[
                  <Button type="link" danger onClick={() => handleDeleteField(field.id)}>
                    Delete
                  </Button>,
                ]}
              >
                {field.name} - {field.type} - {field.placeholder}
              </List.Item>
            )}
          />
        </div>
      </Modal>

      <style jsx>{`
        .document-editor {
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}

export default function CreateFormPage() {
  return (
    <TemplateFormApp>
      <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <TemplatePanel />
          </div>
        </div>
      </div>
    </TemplateFormApp>
  );
}
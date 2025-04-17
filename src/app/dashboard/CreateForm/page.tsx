'use client';
import React, { useState, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/app/config';
import { deleteTemplate, saveTemplate } from '@/utils/api';
import { message, Tooltip } from 'antd';

interface SuperUser { id: string; firstName: string; lastName: string; email?: string; avatar?: string | null; }
export interface FormData { company: string; date: string; customs: string; person: string; vendor: string; contract: string; value: string; mode: string; reference: string; logo: string; invoiceNumber: string; cargoName: string; cargoDescription: string; documentType: string; importPurpose: string; requestPerson: string; requestDepartment: string; declarationNumber: string; quantityBillNumber: string; subContractorName: string; subContractNumber: string; }
export interface TemplateField { id: string; type: string; label: string; value: string; position?: { section: string; index: number; }; }
export interface Reference { id: string; name: string; type: string; }
export interface DynamicDbData { companies: Array<{ id: string; name: string }>; vendors: Array<{ id: string; name: string }>; contracts: Array<{ id: string; name: string }>; customs: Array<{ id: string; name: string }>; documentTypes: Array<{ id: string; name: string }>; subContractorNames: Array<{ id: string; name: string }>; }
export interface FieldMapping { formField: keyof FormData; templateField: string; type: string; source?: keyof DynamicDbData; }
export interface TemplateSection { id: string; title: string; content: string; isEditing: boolean; }
export interface TemplateSectionData { id: string; title: string; content: string; }
interface SavedTemplate { id: string; name?: string | null; sections: TemplateSectionData[]; userId: string; createdAt: string; updatedAt: string; }
interface EditableTextProps { value: string; onSave: (newValue: string) => void; onCancel: () => void; className?: string; }

export interface ContextType {
    dbData: DynamicDbData; formData: FormData; setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    templateFields: TemplateField[]; setTemplateFields: React.Dispatch<React.SetStateAction<TemplateField[]>>;
    fieldMappings: FieldMapping[]; draggingField: TemplateField | null;
    setDraggingField: React.Dispatch<React.SetStateAction<TemplateField | null>>;
    templateSections: TemplateSection[]; setTemplateSections: React.Dispatch<React.SetStateAction<TemplateSection[]>>;
    addFieldToSection: (field: TemplateField, sectionId: string, position: number) => void;
    saveDocumentChanges: () => Promise<void>;
    isLoadingReferences: boolean; referenceError: string | null;
    isCurrentlyEditing: boolean;
    currentTemplateId: string | null;
    setCurrentTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
}

const FormTemplateContext = createContext<ContextType | null>(null);

interface TemplateFormAppProps { children: React.ReactNode; }

// Removed 'export' from the function definition below
function TemplateFormApp({ children }: TemplateFormAppProps) {
    const [allReferences, setAllReferences] = useState<Reference[]>([]);
    const [isLoadingReferences, setIsLoadingReferences] = useState(true);
    const [referenceError, setReferenceError] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>({ company: '', date: new Date().toISOString().split('T')[0], customs: '', person: 'H. Əliyeva', vendor: '', contract: '', value: '100.000', mode: 'vaqonlar', reference: 'OB/FM/0001-03.25', logo: '', invoiceNumber: '', cargoName: '', cargoDescription: 'Hesab-fakturada göstərildiyi kimi', documentType: '', importPurpose: '', requestPerson: '', requestDepartment: '', declarationNumber: '', quantityBillNumber: '', subContractorName: '', subContractNumber: '', });
    const [templateSections, setTemplateSections] = useState<TemplateSection[]>([ { id: 'header', title: 'Header', content: 'Materialların idxal edilməsi və gömrük üzrə məmur', isEditing: false }, { id: 'introduction', title: 'Introduction', content: 'Bunlarla, $company-1$ adından təsdiq edirəm ki, nömrəli vaqonlar ilə idxal edilmiş yüklər $vendor-1$ şirkəti ilə bağlanmış $contract-1$ nömrəli müqavilənin şərtlərinin yerinə yetirilməsi üçün gətirilmişdir.', isEditing: false }, { id: 'footer', title: 'Footer', content: 'Hörmətlə,\n\nFərid Məmmədov', isEditing: false }, { id: 'address', title: 'Address', content: 'BP Xəzər Mərkəzi, Port Bakı\nNeftçilər prospekti, 153\nBakı şəhəri, AZ1010, Azərbaycan', isEditing: false }, { id: 'recipient', title: 'Recipient', content: '$person$', isEditing: false }, { id: 'signature', title: 'Signature', content: 'Farid Məmmədov', isEditing: false }, { id: 'invoice-number-label', title: 'Invoice Number Label', content: 'Hesab-fakturanın No:', isEditing: false }, { id: 'invoice-value-label', title: 'Invoice Value Label', content: 'Dəyəri:', isEditing: false }, { id: 'cargo-name-label', title: 'Cargo Name Label', content: 'Yükün adı:', isEditing: false }, { id: 'cargo-description-label', title: 'Cargo Description Label', content: 'Yükün təsviri:', isEditing: false }, { id: 'customs-value-label', title: 'Customs Value Label', content: 'Gömrük məqsədləri üçün qiyməti Hesab-fakturaya uyğun olaraq:', isEditing: false }, { id: 'date-value', title: 'Date Value', content: '$date-1$', isEditing: false }, { id: 'doc-type-value', title: 'Document Type Value', content: '$document-type$', isEditing: false }, { id: 'request-person-label', title: 'Request Person Label', content: 'Sorğu edən:', isEditing: false }, { id: 'request-person-value', title: 'Request Person Value', content: '$request-person$', isEditing: false }, { id: 'request-dept-label', title: 'Request Department Label', content: 'Departament:', isEditing: false }, { id: 'request-dept-value', title: 'Request Department Value', content: '$request-department$', isEditing: false }, { id: 'import-purpose-label', title: 'Import Purpose Label', content: 'İdxal Məqsədi:', isEditing: false }, { id: 'import-purpose-value', title: 'Import Purpose Value', content: '$import-purpose$', isEditing: false }, { id: 'recipient-label', title: 'Recipient Label', content: 'Kimə:', isEditing: false }, { id: 'recipient-value', title: 'Recipient Value (Customs)', content: '$customs-1$', isEditing: false }, { id: 'invoice-number-value', title: 'Invoice Number Value', content: '$invoice-number$', isEditing: false }, { id: 'cargo-name-value', title: 'Cargo Name Value', content: '$cargo-name$', isEditing: false }, { id: 'cargo-description-value', title: 'Cargo Description Value', content: '$cargo-description$', isEditing: false }, { id: 'amount-value', title: 'Amount Value', content: '$amount-1$', isEditing: false }, { id: 'subcontractor-label', title: 'Subcontractor Label', content: 'Alt Podratçı:', isEditing: false }, { id: 'subcontractor-value', title: 'Subcontractor Value', content: '$subcontractor-name$', isEditing: false }, { id: 'subcontract-num-label', title: 'Subcontract Number Label', content: 'Alt Müqavilə No:', isEditing: false }, { id: 'subcontract-num-value', title: 'Subcontract Number Value', content: '$subcontract-number$', isEditing: false }, ]);
    const [draggingField, setDraggingField] = useState<TemplateField | null>(null);
    const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
    const fieldMappings = useMemo<FieldMapping[]>(() => [ { formField: 'company', templateField: 'company-1', type: 'dropdown', source: 'companies' }, { formField: 'date', templateField: 'date-1', type: 'date' }, { formField: 'customs', templateField: 'customs-1', type: 'dropdown', source: 'customs' }, { formField: 'vendor', templateField: 'vendor-1', type: 'dropdown', source: 'vendors' }, { formField: 'contract', templateField: 'contract-1', type: 'dropdown', source: 'contracts' }, { formField: 'value', templateField: 'amount-1', type: 'number' }, { formField: 'invoiceNumber', templateField: 'invoice-number', type: 'text' }, { formField: 'cargoName', templateField: 'cargo-name', type: 'text' }, { formField: 'cargoDescription', templateField: 'cargo-description', type: 'text' }, { formField: 'documentType', templateField: 'document-type', type: 'dropdown', source: 'documentTypes' }, { formField: 'importPurpose', templateField: 'import-purpose', type: 'text' }, { formField: 'requestPerson', templateField: 'request-person', type: 'text' }, { formField: 'requestDepartment', templateField: 'request-department', type: 'text' }, { formField: 'person', templateField: 'person', type: 'text' }, { formField: 'subContractorName', templateField: 'subcontractor-name', type: 'dropdown', source: 'subContractorNames' }, { formField: 'subContractNumber', templateField: 'subcontract-number', type: 'text' }, ], []);
    const templateFields = useMemo<TemplateField[]>(() => { return fieldMappings.map(mapping => ({ id: mapping.templateField, type: mapping.type, label: mapping.formField.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), value: '', })); }, [fieldMappings]);
    const [templateFieldsState, setTemplateFieldsState] = useState<TemplateField[]>(templateFields);

    useEffect(() => { 
        const fetchReferences = async () => { 
            setIsLoadingReferences(true); setReferenceError(null); 
            try { 
                const token = localStorage.getItem('access_token_w'); 
                const headers: HeadersInit = { 'Content-Type': 'application/json' }; 
                if (token) { 
                    headers['Authorization'] = `Bearer ${token}`; 
                } 
                console.log(`${API_URL}/references`);
                const res = await fetch(`${API_URL}/references`, { headers }); 
                console.log(res);
                if (!res.ok) { 
                    console.log(res);
                    console.log(res.status);
                    throw new Error(`API request failed with status ${res.status}`); 
                } 
                const data = await res.json(); 
                console.log(data);
                if (Array.isArray(data)) { 
                    setAllReferences(data); 
                } else { 
                    throw new Error('API-dən gözlənilməz məlumat formatı gəldi'); 
                } 
            } catch (err: any) { 
                console.error('Error fetching references:', err); 
                setReferenceError(`Referansları çəkərkən xəta baş verdi: ${err.message}`); 
                setAllReferences([]); 
            } finally { 
                setIsLoadingReferences(false); 
            } 
        }; 
        fetchReferences(); 
    }, []);
    const dynamicDbData = useMemo<DynamicDbData>(() => { const data: DynamicDbData = { companies: [], vendors: [], contracts: [], customs: [], documentTypes: [], subContractorNames: [] }; allReferences.forEach(ref => { const item = { id: ref.id, name: ref.name }; switch (ref.type) { case 'Company': data.companies.push(item); break; case 'Vendor Name': data.vendors.push(item); break; case 'Contract Number': data.contracts.push(item); break; case 'Customs Department': data.customs.push(item); break; case 'Document Type': data.documentTypes.push(item); break; case 'Sub-Contractor Name': data.subContractorNames.push(item); break; } }); return data; }, [allReferences]);
    useEffect(() => { if (!isLoadingReferences && dynamicDbData.documentTypes.length > 0 && !formData.documentType) { setFormData(prev => ({ ...prev, documentType: dynamicDbData.documentTypes[0].id })); } }, [dynamicDbData.documentTypes, formData.documentType, isLoadingReferences]);
    useEffect(() => { setTemplateFieldsState(templateFields); }, [templateFields]);
    useEffect(() => { const updatedFields = templateFields.map(tf => { const mapping = fieldMappings.find(m => m.templateField === tf.id); if (!mapping) return tf; const formFieldKey = mapping.formField; const formValueId = formData[formFieldKey]; let displayValue = ''; if (mapping.type === 'dropdown' && mapping.source && formValueId) { const sourceKey = mapping.source; const sourceDataArray = dynamicDbData?.[sourceKey]; const selectedItem = sourceDataArray?.find(item => item.id === formValueId); if (selectedItem) { displayValue = selectedItem.name; } } else if (mapping.type !== 'dropdown') { displayValue = formValueId; } return { ...tf, value: displayValue || '' }; }); setTemplateFieldsState(updatedFields); }, [formData, fieldMappings, dynamicDbData, templateFields]);
    useEffect(() => { const styleElement = document.createElement('style'); styleElement.innerHTML = `
      .editable-text-area {
        width: 100%;
        border: 1px dashed #ccc;
        padding: 8px;
        min-height: 40px;
        white-space: pre-wrap; /* Preserve whitespace and newlines */
        word-wrap: break-word; /* Break long words */
        font-family: inherit; /* Use the same font as the surrounding text */
        font-size: inherit;
        line-height: inherit;
        cursor: pointer;
        transition: border-color 0.2s ease-in-out;
      }
      .editable-text-area:hover {
        border-color: #a0aec0; /* gray-400 */
      }
      .editable-text-area.editing {
        border: 1px solid #4299e1; /* blue-500 */
        cursor: text;
        outline: none;
        resize: none; /* Prevent manual resizing */
        overflow-y: hidden; /* Hide scrollbar initially */
      }
    `; document.head.appendChild(styleElement); return () => { document.head.removeChild(styleElement); }; }, []);

    const addFieldToSection = (field: TemplateField, sectionId: string, position: number) => { const updatedSections = [...templateSections]; const sectionIndex = updatedSections.findIndex(section => section.id === sectionId); if (sectionIndex !== -1) { const section = updatedSections[sectionIndex]; const fieldPlaceholder = `$${field.id}$`; let actualPosition = Math.min(position, section.content.length); const textBefore = section.content.substring(0, actualPosition); const textAfter = section.content.substring(actualPosition); const wordBoundaryBefore = textBefore.lastIndexOf(' ') + 1; const wordBoundaryAfter = textAfter.indexOf(' '); if (wordBoundaryBefore > 0 && actualPosition - wordBoundaryBefore < 5) { actualPosition = wordBoundaryBefore; } else if (wordBoundaryAfter !== -1 && wordBoundaryAfter < 5) { actualPosition += wordBoundaryAfter + 1; } const contentBefore = section.content.substring(0, actualPosition); const contentAfter = section.content.substring(actualPosition); const newContent = `${contentBefore}${fieldPlaceholder}${contentAfter}`.replace(/\s+/g, ' ').trim(); updatedSections[sectionIndex] = { ...section, content: newContent }; setTemplateSections(updatedSections); } };

    const saveDocumentChanges = async (): Promise<void> => {
        const hasOpenEditingSection = templateSections.some(s => s.isEditing);
        
        if (hasOpenEditingSection) {
            message.warning('Zəhmət olmasa, əvvəlcə açıq redaktə rejimləri bitirin.');
            return;
        }
        
        const updatedSections = templateSections.map(s => ({ ...s, isEditing: false }));
        
        const templateName = prompt("Şablon üçün ad daxil edin (opsional):");
        if (templateName === null) {
            message.info('Şablon yadda saxlanılmadı.');
            return;
        }
        
        message.loading({ content: 'Şablon yadda saxlanılır...', key: 'savingTemplate' });
        
        try {
            const sectionsData: TemplateSectionData[] = updatedSections.map(({ id, title, content }) => ({
                id,
                title,
                content
            }));
            
            console.log("Şablon məlumatları API-yə göndərilir:", {
                sections: sectionsData,
                name: templateName || 'üerf'
            });
            
            const savedTemplate = await saveTemplate({
                sections: sectionsData,
                name: templateName || 'üerf'
            });
            
            console.log("API cavabı (savedTemplate):", savedTemplate);
            
            if (savedTemplate && savedTemplate.id) {
                setCurrentTemplateId(savedTemplate.id);
                
                message.success({
                    content: `Şablon '${savedTemplate.name || savedTemplate.id}' uğurla yadda saxlandı!`,
                    key: 'savingTemplate',
                    duration: 3
                });
            } else {
                console.error("Xəta: Backend uğur statusu qaytardı, lakin etibarlı şablon məlumatı yoxdur", savedTemplate);
                message.error({
                    content: 'Xəta: Backend cavabında şablon ID-si olmadı.',
                    key: 'savingTemplate',
                    duration: 5
                });
            }
        } catch (error: any) {
            console.error("Şablonu yadda saxlayarkən xəta (saveDocumentChanges funksiyasında):", error);
            
            if (error.response) {
                console.error("Xəta cavab məlumatları:", error.response.data);
                console.error("Xəta cavab statusu:", error.response.status);
            } else if (error.request) {
                console.error("Xəta sorğusu:", error.request);
            } else {
                console.error('Xəta mesajı:', error.message);
            }
            
            message.error({
                content: `Xəta: ${error.message || 'Şablonu yadda saxlayarkən naməlum xəta.'}`,
                key: 'savingTemplate',
                duration: 5
            });
        }
    };

    const isCurrentlyEditing = useMemo(() => {
        return templateSections.some(section => section.isEditing);
    }, [templateSections]);

    return (
        <FormTemplateContext.Provider value={{
            dbData: dynamicDbData, formData, setFormData, templateFields: templateFieldsState,
            setTemplateFields: setTemplateFieldsState, fieldMappings, draggingField, setDraggingField,
            templateSections, setTemplateSections, addFieldToSection, saveDocumentChanges,
            isLoadingReferences, referenceError,
            isCurrentlyEditing,
            currentTemplateId,
            setCurrentTemplateId,
        }}>
            {children}
        </FormTemplateContext.Provider>
    );
}

const EditableText: React.FC<EditableTextProps> = ({ value, onSave, onCancel, className = '' }) => {
    const [editableValue, setEditableValue] = useState(value);
    const [showFieldMenu, setShowFieldMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [cursorPosition, setCursorPosition] = useState(0);
    const [filteredFields, setFilteredFields] = useState<TemplateField[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    const textRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const context = useContext(FormTemplateContext);
    
    useEffect(() => {
        if (textRef.current) {
            textRef.current.style.height = 'auto';
            textRef.current.style.height = `${textRef.current.scrollHeight}px`;
            textRef.current.focus();
            const len = editableValue.length;
            textRef.current.selectionStart = len;
            textRef.current.selectionEnd = len;
        }
    }, []);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowFieldMenu(false);
                console.log("EditableText clicked outside, calling onSave with:", editableValue);
                onSave(editableValue);
            }
            else if (showFieldMenu && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowFieldMenu(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [editableValue, onSave, showFieldMenu]);
    
    useEffect(() => {
        if (showFieldMenu && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 10);
        } else {
            setSearchQuery('');
        }
    }, [showFieldMenu]);
    
    useEffect(() => {
        if (context?.templateFields && showFieldMenu) {
            if (searchQuery.trim() === '') {
                setFilteredFields(context.templateFields);
            } else {
                const query = searchQuery.toLowerCase();
                const filtered = context.templateFields.filter(field =>
                    field.label.toLowerCase().includes(query) || field.id.toLowerCase().includes(query)
                );
                setFilteredFields(filtered);
            }
        }
    }, [searchQuery, context?.templateFields, showFieldMenu]);
    
    useEffect(() => {
        if (showFieldMenu && context?.templateFields) {
            setFilteredFields(context.templateFields);
        }
    }, [showFieldMenu, context?.templateFields]);
    
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setEditableValue(newValue);
        
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
        
        const cursorPos = e.target.selectionStart;
        setCursorPosition(cursorPos);
        
        if (newValue.charAt(cursorPos - 1) === '#') {
            if (textRef.current && containerRef.current) {
                const textArea = textRef.current;
                
                const textBeforeCursor = newValue.substring(0, cursorPos);
                const lines = textBeforeCursor.split('\n');
                
                const textAreaRect = textArea.getBoundingClientRect();
                const lineHeight = parseInt(window.getComputedStyle(textArea).lineHeight) || 20;
                
                const lineIndex = lines.length - 1;
                const topOffset = lineHeight * (lineIndex + 1);
                
                setMenuPosition({
                    top: topOffset,
                    left: 10
                });
                
                setShowFieldMenu(true);
            }
        }
        else if (showFieldMenu && !newValue.includes('#')) {
            setShowFieldMenu(false);
        }
    };
    
    const handleInsertField = (field: TemplateField) => {
        const fieldPlaceholder = `$${field.id}$`;
        const textBeforeCursor = editableValue.substring(0, cursorPosition);
        const textAfterCursor = editableValue.substring(cursorPosition);
        
        const newTextBeforeCursor = textBeforeCursor.slice(0, -1);
        const newValue = `${newTextBeforeCursor}${fieldPlaceholder}${textAfterCursor}`;
        
        setEditableValue(newValue);
        setShowFieldMenu(false);
        
        if (textRef.current) {
            textRef.current.focus();
            const newCursorPosition = newTextBeforeCursor.length + fieldPlaceholder.length;
            
            setTimeout(() => {
                if (textRef.current) {
                    textRef.current.selectionStart = newCursorPosition;
                    textRef.current.selectionEnd = newCursorPosition;
                    textRef.current.style.height = 'auto';
                    textRef.current.style.height = `${textRef.current.scrollHeight}px`;
                }
            }, 0);
        }
    };
    
    const handleBlur = () => {
        // No action needed here, saving is handled by click outside
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setShowFieldMenu(false);
            onCancel();
        }
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            setShowFieldMenu(false);
            console.log("Ctrl+Enter pressed, calling onSave with:", editableValue);
            onSave(editableValue);
        }
        else if (showFieldMenu) {
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowFieldMenu(false);
            } else if (e.key === 'ArrowDown' || e.key === 'Tab') {
                e.preventDefault();
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }
        }
    };
    
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };
    
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setShowFieldMenu(false);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (textRef.current) {
                textRef.current.focus();
            }
        }
    };
    
    const renderFieldMenu = () => {
        if (!showFieldMenu || !context?.templateFields) return null;
        
        const fieldsByType: Record<string, TemplateField[]> = {};
        
        filteredFields.forEach(field => {
            if (!fieldsByType[field.type]) {
                fieldsByType[field.type] = [];
            }
            fieldsByType[field.type].push(field);
        });
        
        return (
            <div
                ref={menuRef}
                className="absolute bg-white border border-gray-300 shadow-lg rounded-md z-50"
                style={{
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                    maxHeight: '300px',
                    width: '300px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onMouseDown={(e) => e.preventDefault()}
            >
                <div className="p-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Sahə daxil et</h3>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Sahələri axtar..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleSearchKeyDown}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
                
                <div className="overflow-y-auto flex-1 p-1">
                    {filteredFields.length > 0 ? (
                        Object.entries(fieldsByType).map(([type, fields]) => (
                            <div key={type} className="mb-2">
                                <div className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">
                                    {type === 'dropdown' ? 'Dropdown Sahələri' :
                                     type === 'date' ? 'Tarix Sahələri' :
                                     type === 'text' ? 'Mətn Sahələri' :
                                     type === 'number' ? 'Rəqəm Sahələri' :
                                     `${type} Sahələri`}
                                </div>
                                
                                {fields.map(field => (
                                    <div
                                        key={field.id}
                                        className="px-2 py-1.5 flex items-center hover:bg-blue-50 cursor-pointer rounded-sm text-sm transition-colors"
                                        onClick={() => handleInsertField(field)}
                                    >
                                        <div className={`
                                            w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs font-medium
                                            ${type === 'dropdown' ? 'bg-purple-100 text-purple-700' :
                                              type === 'date' ? 'bg-green-100 text-green-700' :
                                              type === 'text' ? 'bg-blue-100 text-blue-700' :
                                              type === 'number' ? 'bg-amber-100 text-amber-700' :
                                              'bg-gray-100 text-gray-700'}
                                        `}>
                                            {type.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-gray-800 font-medium">{field.label}</div>
                                            <div className="text-xs text-gray-500">${field.id}$</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    ) : (
                        <div className="p-3 text-sm text-gray-500 text-center">
                            {searchQuery ? 'Nəticə tapılmadı.' : 'Daxil ediləcək sahə yoxdur.'}
                        </div>
                    )}
                </div>
                
                <div className="p-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                    Əlavə etmək üçün sahəyə klikləyin və ya Esc düyməsi ilə bağlayın.
                </div>
            </div>
        );
    };
    
    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <textarea
                ref={textRef}
                value={editableValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="block w-full border border-blue-400 rounded p-2 min-h-[40px] resize-none overflow-hidden leading-snug focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm"
                placeholder="Mətn daxil edin..."
                rows={1}
            />
            {renderFieldMenu()}
            <div className="text-xs text-gray-500 mt-1 opacity-75">
                <span className="mr-2">
                    <span className="font-medium">Sahə:</span> <code className="bg-gray-200 px-1 rounded">#</code>
                </span>
                <span className="mr-2">
                    <span className="font-medium">Yadda saxla:</span> <code className="bg-gray-200 px-1 rounded">Ctrl+Enter</code>
                </span>
                <span>
                    <span className="font-medium">Ləğv et:</span> <code className="bg-gray-200 px-1 rounded">Esc</code>
                </span>
            </div>
        </div>
    );
};

function LogoUploader({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleClick = () => { fileInputRef.current?.click(); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size <= 1024 * 1024) {
            const reader = new FileReader();
            reader.onloadend = () => { onChange(reader.result as string); };
            reader.readAsDataURL(file);
        } else if (file) {
            message.error('Fayl ölçüsü çox böyükdür (maks. 1MB).');
        }
    };
    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        if (fileInputRef.current) { fileInputRef.current.value = ''; }
    };
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Şirkət Loqosu</label>
            <div onClick={handleClick} className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-blue-400 transition-colors">
                {value ? (
                    <div className="relative group">
                        <img src={value} alt="Şirkət Loqosu" className="max-h-24 mx-auto object-contain rounded" />
                        <button onClick={handleRemove} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1" aria-label="Loqonu sil">✕</button>
                    </div>
                ) : (
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <div className="flex text-sm text-gray-600"><span className="relative bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">Loqo yükləmək üçün klikləyin</span><input ref={fileInputRef} id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" /></div>
                        <p className="text-xs text-gray-500">PNG, JPG (maks. 1MB)</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function FormPanel() {
    const context = useContext(FormTemplateContext);
    const router = useRouter();
    if (!context) throw new Error('FormPanel must be used within a FormTemplateContext Provider');
    const { dbData, formData, setFormData, isLoadingReferences, referenceError } = context;
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleLogoChange = (value: string) => {
        setFormData(prev => ({ ...prev, logo: value }));
    };
    const filteredContracts = dbData.contracts;
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Şablon Yarat</h2>
                <button onClick={() => router.push('/dashboard/PaperCut/Reference')} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"> Referansları İdarə Et </button>
            </div>
            {isLoadingReferences && <div className="text-center p-4 text-blue-600">Referanslar yüklənir...</div>}
            {referenceError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{referenceError}</div>}
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 mb-1">Sahələrin İstifadəsi</h3>
                <p className="text-xs text-blue-700"> Sağdakı şablon önizləməsində hər hansı bir mətn bölməsinə klikləyin. Redaktə rejimində, forma sahəsini mətnə daxil etmək üçün <code className="bg-blue-200 px-1 rounded text-blue-900">#</code> simvolunu yazın və açılan menyudan istədiyiniz sahəni seçin. </p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="md:col-span-2"><LogoUploader value={formData.logo} onChange={handleLogoChange} /></div>
                    <div className="mb-2">
                        <label htmlFor="documentType" className="block text-sm font-medium text-gray-700">Sənəd Tipi</label>
                        <select id="documentType" name="documentType" value={formData.documentType} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={isLoadingReferences || dbData.documentTypes.length === 0}>
                            <option value="">{isLoadingReferences ? 'Yüklənir...' : 'Sənəd tipi seçin'}</option>
                            {dbData.documentTypes.map(docType => (<option key={docType.id} value={docType.id}>{docType.name}</option>))}
                        </select>
                        {dbData.documentTypes.length === 0 && !isLoadingReferences && <p className="text-xs text-red-500 mt-1">Uyğun referans tapılmadı. Zəhmət olmasa, əlavə edin.</p>}
                    </div>
                    <div className="mb-2">
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700">Şirkət (PSA/HGA)</label>
                        <select id="company" name="company" value={formData.company} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={isLoadingReferences || dbData.companies.length === 0}>
                            <option value="">{isLoadingReferences ? 'Yüklənir...' : 'Şirkət seçin'}</option>
                            {dbData.companies.map(company => (<option key={company.id} value={company.id}>{company.name}</option>))}
                        </select>
                        {dbData.companies.length === 0 && !isLoadingReferences && <p className="text-xs text-red-500 mt-1">Uyğun referans tapılmadı.</p>}
                    </div>
                    <div className="mb-2">
                        <label htmlFor="requestPerson" className="block text-sm font-medium text-gray-700">Sorğu Edən Şəxs</label>
                        <input id="requestPerson" type="text" name="requestPerson" value={formData.requestPerson} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Sorğu edən şəxsin adını daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="requestDepartment" className="block text-sm font-medium text-gray-700">Sorğu Edən Departament</label>
                        <input id="requestDepartment" type="text" name="requestDepartment" value={formData.requestDepartment} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Departamentin adını daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700">Tarix</label>
                        <input id="date" type="date" name="date" value={formData.date} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="customs" className="block text-sm font-medium text-gray-700">Gömrük İdarəsi</label>
                        <select id="customs" name="customs" value={formData.customs} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={isLoadingReferences || dbData.customs.length === 0}>
                            <option value="">{isLoadingReferences ? 'Yüklənir...' : 'İdarə seçin'}</option>
                            {dbData.customs.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                        </select>
                        {dbData.customs.length === 0 && !isLoadingReferences && <p className="text-xs text-red-500 mt-1">Uyğun referans tapılmadı.</p>}
                    </div>
                    <div className="mb-2">
                        <label htmlFor="person" className="block text-sm font-medium text-gray-700">Şəxs (Kimə)</label>
                        <input id="person" type="text" name="person" value={formData.person} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Məktubun ünvanlandığı şəxs"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700">Hesab-Faktura Nömrəsi</label>
                        <input id="invoiceNumber" type="text" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Hesab-faktura nömrəsini daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="vendor" className="block text-sm font-medium text-gray-700">Podratçı Adı (Vendor)</label>
                        <select id="vendor" name="vendor" value={formData.vendor} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={isLoadingReferences || dbData.vendors.length === 0}>
                            <option value="">{isLoadingReferences ? 'Yüklənir...' : 'Podratçı seçin'}</option>
                            {dbData.vendors.map(vendor => (<option key={vendor.id} value={vendor.id}>{vendor.name}</option>))}
                        </select>
                        {dbData.vendors.length === 0 && !isLoadingReferences && <p className="text-xs text-red-500 mt-1">Uyğun referans tapılmadı.</p>}
                    </div>
                    <div className="mb-2">
                        <label htmlFor="contract" className="block text-sm font-medium text-gray-700">Müqavilə Nömrəsi</label>
                        <select id="contract" name="contract" value={formData.contract} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={isLoadingReferences || filteredContracts.length === 0}>
                            <option value="">{isLoadingReferences ? 'Yüklənir...' : 'Müqavilə seçin'}</option>
                            {dbData.contracts.map(contract => (<option key={contract.id} value={contract.id}>{contract.name}</option>))}
                        </select>
                        {dbData.contracts.length === 0 && !isLoadingReferences && <p className="text-xs text-red-500 mt-1">Uyğun referans tapılmadı.</p>}
                    </div>
                    <div className="mb-2">
                        <label htmlFor="cargoName" className="block text-sm font-medium text-gray-700">Yükün Adı</label>
                        <input id="cargoName" type="text" name="cargoName" value={formData.cargoName} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Yükün adını daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="cargoDescription" className="block text-sm font-medium text-gray-700">Yükün Təsviri</label>
                        <input id="cargoDescription" type="text" name="cargoDescription" value={formData.cargoDescription} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Yükün təsvirini daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="value" className="block text-sm font-medium text-gray-700">Dəyər Məbləği</label>
                        <input id="value" type="text" name="value" value={formData.value} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Məbləği daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="importPurpose" className="block text-sm font-medium text-gray-700">İdxal Məqsədi</label>
                        <input id="importPurpose" type="text" name="importPurpose" value={formData.importPurpose} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="İdxal məqsədini daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="reference" className="block text-sm font-medium text-gray-700">Referans Nömrəsi</label>
                        <input id="reference" type="text" name="reference" value={formData.reference} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Referans nömrəsini daxil edin"/>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="subContractorName" className="block text-sm font-medium text-gray-700">Alt Podratçı Adı</label>
                        <select id="subContractorName" name="subContractorName" value={formData.subContractorName} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={isLoadingReferences || dbData.subContractorNames.length === 0}>
                            <option value="">{isLoadingReferences ? 'Yüklənir...' : 'Alt podratçı seçin'}</option>
                            {dbData.subContractorNames.map(sub => (<option key={sub.id} value={sub.id}>{sub.name}</option>))}
                        </select>
                        {dbData.subContractorNames.length === 0 && !isLoadingReferences && <p className="text-xs text-red-500 mt-1">Uyğun referans tapılmadı.</p>}
                    </div>
                    <div className="mb-2">
                        <label htmlFor="subContractNumber" className="block text-sm font-medium text-gray-700">Alt Müqavilə Nömrəsi</label>
                        <input id="subContractNumber" type="text" name="subContractNumber" value={formData.subContractNumber} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Alt müqavilə nömrəsini daxil edin"/>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TemplatePanel() {
    const context = useContext(FormTemplateContext);
    const router = useRouter();
    
    if (!context) throw new Error('TemplatePanel must be used within a FormTemplateContext Provider');
    
    const {
        templateFields,
        templateSections,
        setTemplateSections,
        saveDocumentChanges,
        isLoadingReferences,
        isCurrentlyEditing,
        currentTemplateId,
        setCurrentTemplateId
    } = context;

    const toggleEditing = (sectionId: string) => {
        if (!isCurrentlyEditing || templateSections.find(s => s.id === sectionId)?.isEditing) {
            setTemplateSections(prevSections =>
                prevSections.map(section =>
                    section.id === sectionId ? { ...section, isEditing: !section.isEditing } : { ...section, isEditing: false }
                )
            );
        } else {
             message.error('Zəhmət olmasa, əvvəlcə digər bölmənin redaktəsini bitirin.', 2);
        }
    };

    const handleSaveContent = (sectionId: string, newContent: string) => {
        console.log(`Saving content for ${sectionId}:`, newContent);
        
        const updatedSections = templateSections.map(section =>
            section.id === sectionId
                ? { ...section, content: newContent, isEditing: false }
                : section
        );
        
        setTemplateSections(updatedSections);
    };

     const handleCancelEdit = (sectionId: string) => {
         setTemplateSections(prevSections =>
            prevSections.map(section =>
                section.id === sectionId ? { ...section, isEditing: false } : section
            )
        );
    };

    const renderContentWithPlaceholders = (text: string) => {
        if (!context) return text;
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part, index) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1);
                const field = context.templateFields.find(f => f.id === fieldId);
                if (field) {
                    return (
                        <span key={index} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-medium text-xs mx-0.5 align-baseline">
                            {field.value || `[${field.label}]`}
                        </span>
                    );
                } else {
                     return <span key={index} className="text-red-400 text-xs mx-0.5">[{fieldId}?]</span>;
                }
            }
            const lines = part.split('\n');
            return lines.map((line, lineIndex) => (
                <React.Fragment key={`${index}-${lineIndex}`}>
                    {line}
                    {lineIndex < lines.length - 1 && <br />}
                </React.Fragment>
            ));
        });
    };

    const renderEditableSection = (sectionId: string, className: string = '') => {
        const section = templateSections.find(s => s.id === sectionId);
        if (!section) return <div className={`text-red-500 text-xs p-1 ${className}`}>[Bölmə tapılmadı: {sectionId}]</div>;

        if (section.isEditing) {
            return (
                <EditableText
                    value={section.content}
                    onSave={(newContent) => handleSaveContent(sectionId, newContent)}
                    onCancel={() => handleCancelEdit(sectionId)}
                    className={className}
                />
            );
        } else {
            return (
                <div
                    onClick={() => toggleEditing(sectionId)}
                    className={`${className} relative group cursor-pointer transition-colors duration-150 ease-in-out rounded hover:bg-blue-100 p-1 whitespace-pre-wrap min-h-[24px] border border-transparent hover:border-blue-300`}
                >
                    {renderContentWithPlaceholders(section.content)}
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500 bg-opacity-70 text-white text-xs font-medium opacity-0 group-hover:opacity-50 transition-opacity rounded pointer-events-none">
                        Redaktə et
                    </div>
                </div>
            );
        }
    };

    const handleDeleteTemplate = async () => {
        if (window.confirm("Bu şablonu silmək istədiyinizə əminsiniz?")) {
            try {
                if (currentTemplateId) {
                    message.loading({ content: 'Şablon silinir...', key: 'deleteTemplate' });
                    await deleteTemplate(currentTemplateId);
                    message.success({
                        content: 'Şablon uğurla silindi',
                        key: 'deleteTemplate',
                        duration: 3
                    });
                    router.push('/dashboard/PaperCut/Templates');
                } else {
                    message.info('Bu şablon hələ yadda saxlanılmayıb.');
                }
            } catch (error: any) {
                console.error('Error deleting template:', error);
                message.error({
                    content: `Şablonu silərkən xəta baş verdi: ${error.message}`,
                    key: 'deleteTemplate',
                    duration: 3
                });
            }
        }
    };

    const saveButton = (
        <button
            onClick={saveDocumentChanges}
            className={`bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors ${isCurrentlyEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoadingReferences || isCurrentlyEditing}
        >
            Şablonu Yadda Saxla
        </button>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Şablon Önizləməsi</h2>
                <div className="space-x-2 flex items-center">
                     {isCurrentlyEditing ? (
                         <Tooltip title="Zəhmət olmasa, bütün bölmələrin redaktəsini bitirin.">
                             <span className="inline-block">{saveButton}</span>
                         </Tooltip>
                     ) : (
                         saveButton
                     )}
                     <button onClick={handleDeleteTemplate}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                     >
                        Şablonu Sil
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200 min-h-[600px] text-sm font-serif leading-relaxed">
                <div className="flex justify-between items-start mb-8">
                    <div className="w-24 h-16 flex items-center justify-center bg-gray-100 rounded border flex-shrink-0">
                         {context.formData.logo ? ( <img src={context.formData.logo} alt="Şirkət Loqosu" className="max-h-full max-w-full object-contain" /> ) : ( <span className="text-gray-400 text-xs">Loqo</span> )}
                    </div>
                    <div className="text-right space-y-1 ml-4">
                        {renderEditableSection('header')}
                        {renderEditableSection('date-value')}
                    </div>
                </div>

                <div className="mb-6 space-y-1">
                    {renderEditableSection('address')}
                    {renderEditableSection('doc-type-value')}
                </div>

                 <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-6 text-xs space-y-1">
                    <div className="flex">
                        <span className="w-28 font-medium flex-shrink-0">{renderEditableSection('request-person-label', 'inline-block')}</span>
                        {renderEditableSection('request-person-value')}
                    </div>
                     <div className="flex">
                        <span className="w-28 font-medium flex-shrink-0">{renderEditableSection('request-dept-label', 'inline-block')}</span>
                        {renderEditableSection('request-dept-value')}
                    </div>
                     <div className="flex">
                        <span className="w-28 font-medium flex-shrink-0">{renderEditableSection('import-purpose-label', 'inline-block')}</span>
                         {renderEditableSection('import-purpose-value')}
                    </div>
                 </div>

                <div className="mb-6 space-y-1">
                    <div className="flex items-baseline">
                        <span className="w-20 font-medium flex-shrink-0">{renderEditableSection('recipient-label', 'inline-block')}</span>
                        {renderEditableSection('recipient-value')}
                    </div>
                     {renderEditableSection('recipient')}
                </div>

                <div className="mb-6">
                    {renderEditableSection('introduction')}
                </div>

                 <div className="space-y-2 mb-8 border-t border-b border-gray-200 py-4">
                    <div className="flex justify-between items-baseline">
                        {renderEditableSection('invoice-number-label', 'inline-block font-semibold')}
                        {renderEditableSection('invoice-number-value', 'text-right')}
                    </div>
                     <div className="flex justify-between items-baseline">
                        {renderEditableSection('cargo-name-label', 'inline-block font-semibold')}
                        {renderEditableSection('cargo-name-value', 'text-right')}
                    </div>
                     <div className="flex justify-between items-baseline">
                         {renderEditableSection('cargo-description-label', 'inline-block font-semibold mr-2')}
                         {renderEditableSection('cargo-description-value', 'flex-grow text-right')}
                    </div>
                      <div className="flex justify-between items-baseline">
                         {renderEditableSection('subcontractor-label', 'inline-block font-semibold')}
                         {renderEditableSection('subcontractor-value', 'text-right')}
                     </div>
                      <div className="flex justify-between items-baseline">
                         {renderEditableSection('subcontract-num-label', 'inline-block font-semibold')}
                         {renderEditableSection('subcontract-num-value', 'text-right')}
                     </div>
                     <div className="flex justify-between items-baseline">
                        {renderEditableSection('customs-value-label', 'inline-block font-semibold mr-2')}
                        {renderEditableSection('amount-value', 'text-right')}
                    </div>
                 </div>

                <div className="mt-12">
                    {renderEditableSection('footer', 'whitespace-pre-line')}
                </div>

                 <div className="mt-8 pt-8 border-t border-dashed">
                     {renderEditableSection('signature')}
                 </div>

                <div className="mt-10 pt-4 border-t border-gray-200">
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Təsdiqləmə Prosesi</h4>
                    <div className="flex space-x-4 items-center text-xs">
                        <div className="flex items-center text-green-600"><span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white mr-1.5">1</span><span>Qaralama</span><span className="mx-2 text-gray-300">&rarr;</span></div>
                        <div className="flex items-center text-gray-500"><span className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 mr-1.5">2</span><span>Rəy</span><span className="mx-2 text-gray-300">&rarr;</span></div>
                        <div className="flex items-center text-gray-500"><span className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 mr-1.5">3</span><span>Təsdiqlənib</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CreateFormPage() {
    return (
        <TemplateFormApp>
            <div className="min-h-screen bg-gray-100 p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <FormPanel />
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <TemplatePanel />
                    </div>
                </div>
            </div>
        </TemplateFormApp>
    );
}
'use client'; // Indicate this is a Client Component

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Select, message, Spin, Button, Image as AntImage } from 'antd';
import {
    getTemplates,
    getTemplateById,
    getReferences,
    saveLetter,
    uploadImage,
    fetchSharedTemplates,
    getTemplateDetailsForUser
} from '@/utils/api';
import axios from 'axios';

interface Reference { id: string; name: string; type: string; }
interface DynamicDbData { companies: Array<{ id: string; name: string }>; vendors: Array<{ id: string; name: string }>; contracts: Array<{ id: string; name: string }>; customs: Array<{ id: string; name: string }>; documentTypes: Array<{ id: string; name: string }>; subContractorNames: Array<{ id: string; name: string }>; }

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
interface TemplateSectionData { id: string; title: string; content: string; }
interface SavedTemplate { id: string; name?: string | null; sections: TemplateSectionData[]; userId: string; createdAt: string; updatedAt: string; }
interface SavedLetter { id: string; name?: string | null; templateId: string; userId: string; formData: Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>; logoUrl?: string | null; signatureUrl?: string | null; stampUrl?: string | null; createdAt: string; updatedAt: string; }

interface MyTemplate { id: string; name?: string | null; sections: TemplateSectionData[]; userId: string; createdAt: string; updatedAt: string; }
interface SharedTemplate extends MyTemplate {
    creator?: { id: string; firstName: string | null; lastName: string | null; };
}
type SelectedTemplate = MyTemplate;

interface SignatureData {
    id: string;
    r2Url: string;
    name?: string;
    createdAt: string;
}
interface StampData {
    id: string;
    r2Url: string;
    name?: string;
    createdAt: string;
}


const extractPlaceholders = (text: string): string[] => {
    const regex = /\$([a-zA-Z0-9-]+)\$/g;
    const placeholders = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
        placeholders.add(match[1]);
    }
    return Array.from(placeholders);
};

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


function LogoUploader({imageUrl, onFileSelect, onRemove, isLoading }: { imageUrl: string | null; onFileSelect: (file: File) => void; onRemove: () => void; isLoading?: boolean; }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const MAX_SIZE_MB = 2;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    const handleClick = () => { if (!isLoading) fileInputRef.current?.click(); };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > MAX_SIZE_BYTES) { message.error(`Fayl ölçüsü çox böyükdür (maks. ${MAX_SIZE_MB}MB).`); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
            if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) { message.error('Yalnız PNG, JPG, GIF, WEBP formatlı şəkillər yüklənə bilər.'); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
            onFileSelect(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveClick = (e: React.MouseEvent) => { e.stopPropagation(); onRemove(); };

    return (
        <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Şirkət Loqosu</label>
            <div onClick={handleClick} className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${isLoading ? 'border-blue-300' : 'border-gray-300'} border-dashed rounded-md ${isLoading ? 'cursor-wait bg-gray-50' : 'cursor-pointer hover:border-blue-400'} transition-colors min-h-[100px] items-center group relative`}>
                {isLoading ? (<Spin tip="Yüklənir..." />)
                : imageUrl ? (
                    <div className="text-center">
                         <AntImage src={imageUrl} alt="Şirkət Loqosu" className="max-h-24 mx-auto object-contain rounded" preview={{ mask: <span className="text-white text-xs">Önizlə</span> }} onError={(e) => { console.error("Error loading logo preview from URL"); }} />
                         <button onClick={handleRemoveClick} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1" aria-label="Loqonu sil" title="Loqonu sil">✕</button>
                    </div>
                ) : (
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <div className="flex text-sm text-gray-600"><span className="relative bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">Loqo yükləmək üçün klikləyin</span>
                            <input ref={fileInputRef} id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif, image/webp" />
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF, WEBP (maks. {MAX_SIZE_MB}MB)</p>
                    </div>
                )}
            </div>
             <p className="text-xs text-gray-500 mt-1 italic">Loqo Cloudflare R2 anbarında saxlanılır.</p>
        </div>
    );
}


// --- UPDATED LetterFormPanel Component ---
function LetterFormPanel({
    formData,
    dbData,
    isLoadingReferences,
    referenceError,
    requiredFields,
    savedSignatures,
    savedStamps,
    onUploadLogo,
    onRemoveLogo,
    isUploadingLogo,
    onSelectSignature, // NEW
    onSelectStamp,     // NEW
    onInputChange,     // NEW
}: {
    formData: FormData;
    dbData: DynamicDbData;
    isLoadingReferences: boolean;
    referenceError: string | null;
    requiredFields: Set<keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>>; // Required fields are non-image
    savedSignatures: SignatureData[];
    savedStamps: StampData[];
    onUploadLogo: (file: File) => void;
    onRemoveLogo: () => void;
    isUploadingLogo: boolean;
    onSelectSignature: (url: string | null) => void;
    onSelectStamp: (url: string | null) => void;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}) {

    // Helper to render fields (SIGNATURE/STAMP DROPDOWNS REMOVED)
    const renderFieldIfRequired = (fieldName: keyof FormData, label: string, inputElement: React.ReactNode) => {
        // Check if the non-image field is required based on placeholders
        const isCoreField = fieldName !== 'logoUrl' && fieldName !== 'signatureUrl' && fieldName !== 'stampUrl';
        const isRequired = isCoreField && requiredFields.has(fieldName as keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>);

        // Always render logo uploader
        const alwaysRender = fieldName === 'logoUrl';

        // Don't render non-required core fields
        if (isCoreField && !isRequired) return null;
        // Don't render signature/stamp fields here at all
        if (fieldName === 'signatureUrl' || fieldName === 'stampUrl') return null;


        if (fieldName === 'logoUrl') {
            return (
                <div className="mb-3 md:col-span-2">
                    <LogoUploader
                        imageUrl={formData.logoUrl}
                        onFileSelect={onUploadLogo}
                        onRemove={onRemoveLogo}
                        isLoading={isUploadingLogo}
                    />
                </div>
            );
        }

        // Default rendering for other fields
        return (
            <div className={`mb-3`}>
                <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700 mb-0.5">
                    {label} {isRequired && <span className="text-red-500">*</span>}
                </label>
                {/* Use the passed input change handler */}
                {React.isValidElement(inputElement) ? React.cloneElement(inputElement, { onChange: onInputChange, name: fieldName, id: fieldName } as any) : inputElement}
            </div>
        );
    };

    return (
        <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Məktub Məlumatları</h3>
            {isLoadingReferences && <div className="text-center p-4"><Spin tip="Referanslar yüklənir..." /></div>}
            {referenceError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{referenceError}</div>}

            {!isLoadingReferences && !referenceError && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1">
                    {/* Render Logo Uploader */}
                    {renderFieldIfRequired('logoUrl', 'Şirkət Loqosu', null)}

                    {/* Render other fields dynamically */}
                    {renderFieldIfRequired('company', 'Şirkət (PSA/HGA)', ( <select value={formData.company} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={dbData.companies.length === 0}><option value="">Şirkət seçin</option>{dbData.companies.map(company => (<option key={company.id} value={company.id}>{company.name}</option>))}</select> ))}
                    {renderFieldIfRequired('date', 'Tarix', ( <input type="date" value={formData.date} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"/> ))}
                    {renderFieldIfRequired('customs', 'Gömrük İdarəsi', ( <select value={formData.customs} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={dbData.customs.length === 0}><option value="">İdarə seçin</option>{dbData.customs.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select> ))}
                    {renderFieldIfRequired('person', 'Şəxs (Kimə)', ( <input type="text" value={formData.person} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Məktubun ünvanlandığı şəxs"/> ))}
                    {renderFieldIfRequired('vendor', 'Podratçı Adı (Vendor)', ( <select value={formData.vendor} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={dbData.vendors.length === 0}><option value="">Podratçı seçin</option>{dbData.vendors.map(vendor => (<option key={vendor.id} value={vendor.id}>{vendor.name}</option>))}</select> ))}
                    {renderFieldIfRequired('contract', 'Müqavilə Nömrəsi', ( <select value={formData.contract} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={dbData.contracts.length === 0}><option value="">Müqavilə seçin</option>{dbData.contracts.map(contract => (<option key={contract.id} value={contract.id}>{contract.name}</option>))}</select> ))}
                    {renderFieldIfRequired('documentType', 'Sənəd Tipi', ( <select value={formData.documentType} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={dbData.documentTypes.length === 0}><option value="">Sənəd tipi seçin</option>{dbData.documentTypes.map(docType => (<option key={docType.id} value={docType.id}>{docType.name}</option>))}</select> ))}
                    {renderFieldIfRequired('invoiceNumber', 'Hesab-Faktura Nömrəsi', ( <input type="text" value={formData.invoiceNumber} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Hesab-faktura nömrəsi"/> ))}
                    {renderFieldIfRequired('value', 'Dəyər Məbləği', ( <input type="text" value={formData.value} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Məbləği daxil edin"/> ))}
                    {renderFieldIfRequired('cargoName', 'Yükün Adı', ( <input type="text" value={formData.cargoName} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Yükün adını daxil edin"/> ))}
                    {renderFieldIfRequired('cargoDescription', 'Yükün Təsviri', ( <input type="text" value={formData.cargoDescription} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Yükün təsvirini daxil edin"/> ))}
                    {renderFieldIfRequired('importPurpose', 'İdxal Məqsədi', ( <input type="text" value={formData.importPurpose} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="İdxal məqsədini daxil edin"/> ))}
                    {renderFieldIfRequired('requestPerson', 'Sorğu Edən Şəxs', ( <input type="text" value={formData.requestPerson} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Sorğu edən şəxs"/> ))}
                    {renderFieldIfRequired('requestDepartment', 'Sorğu Edən Departament', ( <input type="text" value={formData.requestDepartment} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Departamentin adı"/> ))}
                    {renderFieldIfRequired('subContractorName', 'Alt Podratçı Adı', ( <select value={formData.subContractorName} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100" disabled={dbData.subContractorNames.length === 0}><option value="">Alt podratçı seçin</option>{dbData.subContractorNames.map(sub => (<option key={sub.id} value={sub.id}>{sub.name}</option>))}</select> ))}
                    {renderFieldIfRequired('subContractNumber', 'Alt Müqavilə Nömrəsi', ( <input type="text" value={formData.subContractNumber} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Alt müqavilə nömrəsi"/> ))}
                 </div>
            )}

            {/* --- NEW: Signature Thumbnails --- */}
            <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-600 mb-3">İmzalar</h4>
                {savedSignatures.length === 0 ? (
                    <p className="text-sm text-gray-500">Heç bir imza yadda saxlanmayıb.</p>
                ) : (
                    <div className="flex flex-wrap gap-3">
                         <button
                             type="button"
                             onClick={() => onSelectSignature(null)}
                             className={`px-3 py-1.5 border rounded-md text-xs flex items-center justify-center min-w-[80px] h-[50px] transition-colors ${!formData.signatureUrl ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}`}
                         >
                             İmza Yoxdur
                         </button>
                        {savedSignatures.map(sig => (
                            <button
                                key={sig.id}
                                type="button"
                                onClick={() => onSelectSignature(sig.r2Url)}
                                className={`p-1 border rounded-md hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 transition-all duration-150 h-[50px] flex items-center justify-center ${formData.signatureUrl === sig.r2Url ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}
                                title={sig.name || `İmza ${new Date(sig.createdAt).toLocaleDateString()}`}
                            >
                                <AntImage
                                    src={sig.r2Url}
                                    alt={sig.name || 'İmza'}
                                    width={80}
                                    height={35}
                                    preview={false}
                                    className="object-contain"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

             {/* --- NEW: Stamp Thumbnails --- */}
             <div className="mt-5 pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-600 mb-3">Möhürlər</h4>
                 {savedStamps.length === 0 ? (
                    <p className="text-sm text-gray-500">Heç bir möhür yadda saxlanmayıb.</p>
                 ) : (
                    <div className="flex flex-wrap gap-3 items-center">
                          <button
                             type="button"
                             onClick={() => onSelectStamp(null)}
                              className={`px-3 py-1.5 border rounded-md text-xs flex items-center justify-center min-w-[60px] h-[60px] transition-colors ${!formData.stampUrl ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}`}
                         >
                             Möhür Yoxdur
                         </button>
                        {savedStamps.map(stamp => (
                             <button
                                key={stamp.id}
                                type="button"
                                onClick={() => onSelectStamp(stamp.r2Url)}
                                className={`p-1 border rounded-full hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 transition-all duration-150 w-[60px] h-[60px] flex items-center justify-center ${formData.stampUrl === stamp.r2Url ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}
                                title={stamp.name || `Möhür ${new Date(stamp.createdAt).toLocaleDateString()}`}
                            >
                                <AntImage
                                    src={stamp.r2Url}
                                    alt={stamp.name || 'Möhür'}
                                    width={45}
                                    height={45}
                                    preview={false}
                                    className="object-contain rounded-full"
                                />
                            </button>
                        ))}
                    </div>
                 )}
            </div>

            {/* Show message if template requires no fields */}
            {requiredFields.size === 0 && !isLoadingReferences && !referenceError && (
                <p className="text-sm text-gray-500 italic mt-4">Bu şablon üçün məlumat sahəsi tələb olunmur.</p>
            )}
        </div>
    );
}


function LetterPreviewPanel({
    template,
    formData,
    dbData,
    onSaveLetter,
    isSaving,
}: {
    template: SavedTemplate | null;
    formData: FormData;
    dbData: DynamicDbData;
    onSaveLetter: () => void;
    isSaving: boolean;
}) {
    // Placeholder replacement logic
    const renderContentWithPlaceholders = useCallback((text: string): React.ReactNode => {
        if (!text) return '';
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part, index) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1);
                const formFieldKey = getFormFieldKeyFromPlaceholder(fieldId);
                if (formFieldKey) {
                    const formValue = formData[formFieldKey]; // Access core form data
                    let displayValue: string | number | readonly string[] | undefined = formValue;

                    // Handle dropdown display values
                    const dropdownKeys: (keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>)[] = ['company', 'customs', 'vendor', 'contract', 'documentType', 'subContractorName'];
                    if (dropdownKeys.includes(formFieldKey) && formValue && dbData) {
                        const sourceKey = (formFieldKey === 'documentType' ? 'documentTypes' : formFieldKey === 'subContractorName' ? 'subContractorNames' : `${formFieldKey}s`) as keyof DynamicDbData;
                        const sourceDataArray = dbData[sourceKey] as Array<{ id: string; name: string }> | undefined;
                        const selectedItem = sourceDataArray?.find(item => item.id === formValue);
                        displayValue = selectedItem ? selectedItem.name : `[ID: ${formValue}?]`;
                    }
                     // Format date
                     if (formFieldKey === 'date' && displayValue) {
                        try { displayValue = new Date(displayValue + 'T00:00:00').toLocaleDateString('az-AZ', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) {} // Add T00:00:00 to avoid timezone issues
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
        return <div className="flex items-center justify-center h-full text-gray-500">Məktub önizləməsi üçün şablon seçin.</div>;
    }

    // Helper to render a template section by its ID
    const renderSection = (sectionId: string, className: string = '') => {
        const section = template.sections.find(s => s.id === sectionId);
        if (!section) return null;
        const contentNode = renderContentWithPlaceholders(section.content);
        // Use whitespace-pre-line to respect newlines from the template content
        return <div className={`${className} whitespace-pre-line leading-relaxed`}>{contentNode}</div>;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-700">Məktub Önizləməsi</h3>
                 <Button type="primary" onClick={onSaveLetter} loading={isSaving} disabled={!template || isSaving}>
                    Məktubu Yadda Saxla
                </Button>
            </div>
            {/* Use relative positioning on the parent for absolute positioning of signature/stamp */}
            <div className="relative bg-white p-8 pr-12 pl-12 rounded-lg shadow border border-gray-200 min-h-[800px] text-sm font-serif leading-relaxed"> {/* Added padding, increased min-height */}

                {/* --- Letter Content (Header, Address, Body, etc.) --- */}
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
                {/* --- End Letter Content --- */}


                 {/* --- NEW: Signature and Stamp Area (Absolutely Positioned) --- */}
                 <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end h-24"> {/* Adjust bottom/left/right/height as needed */}
                    {/* Signature Area (Left) */}
                    <div className="w-1/2 text-left flex flex-col justify-end"> {/* Take half width, align content bottom-left */}
                          {/* Render signature text block from template (e.g., name/title) */}
                          <div className="mb-1">
                             {renderSection('signature')}
                         </div>
                         {/* Signature Image */}
                         {formData.signatureUrl && (
                             <div className="h-16"> {/* Fixed height container */}
                                <AntImage
                                    src={formData.signatureUrl}
                                    alt="Signature Preview"
                                    className="max-h-full max-w-[200px] object-contain" // Constrain width
                                    preview={false}
                                />
                             </div>
                         )}
                    </div>

                    {/* Stamp Area (Right) */}
                    <div className="w-1/2 flex justify-end items-center"> {/* Take half width, align content right */}
                         {/* Stamp Image */}
                        {formData.stampUrl && (
                            <div className="w-24 h-24 flex items-center justify-center"> {/* Fixed size container */}
                                <AntImage
                                    src={formData.stampUrl}
                                    alt="Stamp Preview"
                                    className="max-h-full max-w-full object-contain opacity-85" // Slight opacity
                                    preview={false}
                                />
                            </div>
                        )}
                    </div>
                 </div>
                 {/* --- End Signature and Stamp Area --- */}

            </div>
        </div>
    );
}


// --- Main Page Component ---
export default function CreateLetterPage() {
    const router = useRouter();
    // Template state
    const [myTemplates, setMyTemplates] = useState<MyTemplate[]>([]); // Renamed
    const [sharedTemplates, setSharedTemplates] = useState<SharedTemplate[]>([]); // Added state for shared
    
    const [availableTemplates, setAvailableTemplates] = useState<SavedTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    const [isLoadingTemplateDetails, setIsLoadingTemplateDetails] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);
    // Reference data state
    const [allReferences, setAllReferences] = useState<Reference[]>([]);
    const [isLoadingReferences, setIsLoadingReferences] = useState(true);
    const [referenceError, setReferenceError] = useState<string | null>(null);
    // Signature/Stamp state
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([]);
    const [savedStamps, setSavedStamps] = useState<StampData[]>([]);
    // Loading/Saving state
    const [isSavingLetter, setIsSavingLetter] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        company: '', date: new Date().toISOString().split('T')[0], customs: '', person: '', vendor: '', contract: '', value: '', mode: '', reference: '',
        invoiceNumber: '', cargoName: '', cargoDescription: '', documentType: '', importPurpose: '', requestPerson: '', requestDepartment: '', declarationNumber: '', quantityBillNumber: '', subContractorName: '', subContractNumber: '',
        logoUrl: null, signatureUrl: null, stampUrl: null, 
    });

    useEffect(() => { // Fetch Templates (Owned and Shared)
        const fetchAllTemplates = async () => {
            setIsLoadingTemplates(true);
            setTemplateError(null);
            try {
                const [myTpls, sharedTpls] = await Promise.all([
                    getTemplates(),        // Assuming calls GET /templates
                    fetchSharedTemplates() // Assuming calls GET /templates/shared-with-me
                ]);
                setMyTemplates(myTpls || []);
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
        fetchAllTemplates();
    }, []); 
    useEffect(() => {
        const fetchReferences = async () => { setIsLoadingReferences(true); setReferenceError(null); try { const refs = await getReferences(); setAllReferences(refs); } catch (err: any) { const msg = err.message || 'Referansları yükləyərkən xəta.'; console.error("Reference fetch error:", err); setReferenceError(msg); message.error(msg); setAllReferences([]); } finally { setIsLoadingReferences(false); } }; fetchReferences();
    }, []);
    useEffect(() => { // Fetch Template Details (UPDATED)
        if (!selectedTemplateId) {
            setSelectedTemplate(null);
            return;
        }
        const fetchDetails = async () => {
             setIsLoadingTemplateDetails(true);
             setTemplateError(null);
             setSelectedTemplate(null);
             try {
                 // --- Use the new API function here ---
                 const details = await getTemplateDetailsForUser(selectedTemplateId);
                 setSelectedTemplate(details);
                 // Reset form data (keep date/images)
                 setFormData(prev => ({ company: '', date: prev.date, customs: '', person: '', vendor: '', contract: '', value: '', mode: '', reference: '', invoiceNumber: '', cargoName: '', cargoDescription: '', documentType: '', importPurpose: '', requestPerson: '', requestDepartment: '', declarationNumber: '', quantityBillNumber: '', subContractorName: '', subContractNumber: '', logoUrl: prev.logoUrl, signatureUrl: prev.signatureUrl, stampUrl: prev.stampUrl }));
             } catch (err: any) {
                 const msg = err.message || 'Şablon detallarını yükləyərkən xəta.';
                 console.error("Template details fetch error:", err);
                 setTemplateError(msg);
                 message.error(msg); // Show error message to user
                 setSelectedTemplate(null);
                 setSelectedTemplateId(null); // Reset selection on error
             } finally {
                 setIsLoadingTemplateDetails(false);
             }
        };
        fetchDetails();
    }, [selectedTemplateId]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const sigsRaw = localStorage.getItem('signatures_r2'); // Use the correct key
                if (sigsRaw) {
                    const parsedSigs: Array<{id: string, url: string, createdAt: string, name?:string}> = JSON.parse(sigsRaw);
                     // Adapt the structure to match SignatureData (expecting r2Url)
                     setSavedSignatures(parsedSigs.map(s => ({ id: s.id, r2Url: s.url, createdAt: s.createdAt, name: s.name })));
                } else {
                     setSavedSignatures([]); // Ensure it's an empty array if nothing is found
                }
            } catch (e) { console.error("Failed to load/parse signatures from localStorage", e); setSavedSignatures([]); }

            try {
                const stmpsRaw = localStorage.getItem('stamps_r2'); // Use the correct key
                if (stmpsRaw) {
                     const parsedStamps: Array<{id: string, url: string, createdAt: string, name?: string}> = JSON.parse(stmpsRaw);
                     // Adapt the structure to match StampData (expecting r2Url)
                    setSavedStamps(parsedStamps.map(s => ({ id: s.id, r2Url: s.url, createdAt: s.createdAt, name: s.name })));
                } else {
                     setSavedStamps([]); // Ensure it's an empty array if nothing is found
                }
            } catch (e) { console.error("Failed to load/parse stamps from localStorage", e); setSavedStamps([]); }
        }
    }, []);

    // --- Memoized Calculations ---
    const dynamicDbData = useMemo<DynamicDbData>(() => {
        const data: DynamicDbData = { companies: [], vendors: [], contracts: [], customs: [], documentTypes: [], subContractorNames: [] };
        allReferences.forEach(ref => { const item = { id: ref.id, name: ref.name }; switch (ref.type) { case 'Company': data.companies.push(item); break; case 'Vendor Name': data.vendors.push(item); break; case 'Contract Number': data.contracts.push(item); break; case 'Customs Department': data.customs.push(item); break; case 'Document Type': data.documentTypes.push(item); break; case 'Sub-Contractor Name': data.subContractorNames.push(item); break; } }); return data;
    }, [allReferences]);

    const requiredFields = useMemo((): Set<keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>> => {
         const fields = new Set<keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>>();
         if (!selectedTemplate) return fields;
         selectedTemplate.sections.forEach(section => {
             extractPlaceholders(section.content).forEach(placeholderId => {
                 const formKey = getFormFieldKeyFromPlaceholder(placeholderId);
                 if (formKey) {
                     fields.add(formKey);
                 }
             });
         });
         return fields;
     }, [selectedTemplate]);

     const templateOptions = useMemo(() => {
        const myOptions = myTemplates.map(tpl => ({
            label: tpl.name || `Şablonum ${tpl.id.substring(0, 6)}...`, // My Template
            value: tpl.id,
        }));

        const sharedOptions = sharedTemplates.map(tpl => {
            const creatorName = tpl.creator ? `${tpl.creator.firstName || ''} ${tpl.creator.lastName || ''}`.trim() : null;
            let label = tpl.name || `Adsız Şablon ${tpl.id.substring(0, 6)}...`;
            if (creatorName) {
                 label += ` (Paylaşan: ${creatorName})`;
            } else {
                 label += ` (Paylaşılıb)`;
            }
            return { label, value: tpl.id };
        });

        const myTemplateIds = new Set(myOptions.map(o => o.value));
        const uniqueSharedOptions = sharedOptions.filter(o => !myTemplateIds.has(o.value));

        const options = [];
        if (myOptions.length > 0) {
            options.push({ label: 'Mənim Şablonlarım', options: myOptions });
        }
        if (uniqueSharedOptions.length > 0) {
            options.push({ label: 'Mənimlə Paylaşılanlar', options: uniqueSharedOptions });
        }

        return options;

    }, [myTemplates, sharedTemplates]);

     const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []); // No dependencies needed if it only uses e.target

    // NEW: Handler for selecting a signature thumbnail
    const handleSelectSignature = useCallback((url: string | null) => {
        setFormData(prev => ({ ...prev, signatureUrl: url }));
    }, []); // No dependencies needed

    // NEW: Handler for selecting a stamp thumbnail
    const handleSelectStamp = useCallback((url: string | null) => {
        setFormData(prev => ({ ...prev, stampUrl: url }));
    }, []); // No dependencies needed

    // Logo Upload/Remove Handlers
    const handleUploadLogo = async (file: File) => {
        setIsUploadingLogo(true);
        message.loading({ content: 'Loqo yüklənir...', key: 'logoUpload' });
        try {
            const response = await uploadImage(file, 'logo');
            setFormData(prev => ({ ...prev, logoUrl: response.url }));
            message.success({ content: 'Loqo uğurla yükləndi!', key: 'logoUpload', duration: 2 });
        } catch (error: any) {
            console.error("Logo upload error:", error);
            message.error({ content: `Loqo yüklənərkən xəta: ${error.message || 'Naməlum xəta'}`, key: 'logoUpload', duration: 4 });
            setFormData(prev => ({ ...prev, logoUrl: null }));
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleRemoveLogo = () => {
        // Optional: Add backend call to delete from R2 if necessary
        setFormData(prev => ({ ...prev, logoUrl: null }));
        message.info('Loqo silindi.');
    };

    // Save Letter Handler
    const handleSaveLetter = async () => {
        if (!selectedTemplate || !selectedTemplateId) { message.error("Məktubu yadda saxlamazdan əvvəl şablon seçin."); return; }

        // Validation: Check only the fields required by the template's placeholders
        let missingFields: string[] = [];
        requiredFields.forEach(fieldKey => {
             // Get the label for the field (improve this mapping if needed)
             const label = fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            if (!formData[fieldKey] || String(formData[fieldKey]).trim() === '') {
                 missingFields.push(label || fieldKey);
             }
        });
        if (missingFields.length > 0) {
            message.warning(`Zəhmət olmasa, tələb olunan sahələri doldurun: ${missingFields.join(', ')}`);
            return;
        }

        setIsSavingLetter(true);
        message.loading({ content: 'Məktub yadda saxlanılır...', key: 'savingLetter' });
        try {
            const letterPayload = {
                templateId: selectedTemplateId,
                formData: formData, 
            };
            const savedLetterData = await saveLetter(letterPayload);
            message.success({ content: `Məktub (ID: ${savedLetterData.id}) uğurla yadda saxlandı!`, key: 'savingLetter', duration: 3 });

            setSelectedTemplateId(null);
            setSelectedTemplate(null);
            setFormData({ company: '', date: new Date().toISOString().split('T')[0], customs: '', person: '', vendor: '', contract: '', value: '', mode: '', reference: '', invoiceNumber: '', cargoName: '', cargoDescription: '', documentType: '', importPurpose: '', requestPerson: '', requestDepartment: '', declarationNumber: '', quantityBillNumber: '', subContractorName: '', subContractNumber: '', logoUrl: null, signatureUrl: null, stampUrl: null });

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

    // --- Render ---
    return (
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
                    onChange={(value) => setSelectedTemplateId(value)} // Sets the selected ID
                    disabled={isLoadingTemplates || isLoadingTemplateDetails}
                    showSearch
                    optionFilterProp="label"
                    options={templateOptions}
                 />
                 {/* --- End Use new options --- */}
                 {templateError && <p className="text-red-500 text-xs mt-1">{templateError}</p>}
                 {isLoadingTemplateDetails && <div className="mt-2 text-center"><Spin size="small" /> Şablon yüklənir...</div>}
            </div>

             {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Panel */}
                 <div className={`bg-white rounded-lg shadow-md p-6 transition-opacity duration-300 ${!selectedTemplateId || isLoadingTemplateDetails ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {selectedTemplateId && !isLoadingTemplateDetails && selectedTemplate ? (
                        <LetterFormPanel
                            formData={formData}
                            dbData={dynamicDbData}
                            isLoadingReferences={isLoadingReferences}
                            referenceError={referenceError}
                            requiredFields={requiredFields}
                            savedSignatures={savedSignatures}
                            savedStamps={savedStamps}
                            onUploadLogo={handleUploadLogo}
                            onRemoveLogo={handleRemoveLogo}
                            isUploadingLogo={isUploadingLogo}
                            onSelectSignature={handleSelectSignature}
                            onSelectStamp={handleSelectStamp}
                            onInputChange={handleInputChange} // Pass general input handler
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
                        dbData={dynamicDbData}
                        onSaveLetter={handleSaveLetter}
                        isSaving={isSavingLetter}
                    />
                </div>
            </div>
        </div>
    );
}
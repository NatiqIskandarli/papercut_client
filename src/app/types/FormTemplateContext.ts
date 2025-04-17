import React, { createContext } from 'react';

export interface FormData {
  company: string;
  date: string;
  customs: string;
  person: string;
  vendor: string;
  contract: string;
  value: string;
  mode: string;
  reference: string;
  logo: string; // Base64 encoded image or URL
  invoiceNumber: string;
  cargoName: string;
  cargoDescription: string;
  documentType: string;
  importPurpose: string;
  requestPerson: string;
  requestDepartment: string;
  declarationNumber: string;
  quantityBillNumber: string;
  subContractorName: string;
  subContractNumber: string;
}

export interface TemplateField {
  id: string;
  type: string;
  label: string;
  value: string;
  position?: {
    section: string;
    index: number;
  };
}

export interface FieldMapping {
  formField: keyof FormData;
  templateField: string;
  type: string;
  source?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  content: string;
  isEditing: boolean;
}

export interface ContextType {
  dbData: any; // Məsələn, { companies: any[], vendors: any[], contracts: any[], customs: any[] }
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  templateFields: TemplateField[];
  setTemplateFields: React.Dispatch<React.SetStateAction<TemplateField[]>>;
  fieldMappings: FieldMapping[];
  draggingField: TemplateField | null;
  setDraggingField: React.Dispatch<React.SetStateAction<TemplateField | null>>;
  templateSections: TemplateSection[];
  setTemplateSections: React.Dispatch<React.SetStateAction<TemplateSection[]>>;
  addFieldToSection: (field: TemplateField, sectionId: string, position: number) => void;
  saveDocumentChanges: () => void;
}

export const FormTemplateContext = createContext<ContextType | null>(null);

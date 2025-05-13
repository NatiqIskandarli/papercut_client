'use client';
import React, { useState, useEffect, createContext, useContext } from 'react';

export interface CustomField {
  id: string;
  name: string;
  type: string;
  initialValue: string;
  placeholder: string;
}

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
  logo: string;
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


interface ContextType {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  customFields: CustomField[];
  setCustomFields: React.Dispatch<React.SetStateAction<CustomField[]>>;
  templateContent: string;
  setTemplateContent: React.Dispatch<React.SetStateAction<string>>;
  saveDocumentChanges: () => Promise<void>;
  isLoadingReferences: boolean;
  referenceError: string | null;
  currentTemplateId: string | null;
  setCurrentTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
}


export const FormTemplateContext = createContext<ContextType | null>(null);
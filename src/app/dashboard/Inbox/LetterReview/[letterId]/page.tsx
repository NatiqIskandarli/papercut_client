'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Alert, Button, Typography, Row, Col, message, Tag, Modal, Input, Select, List, Avatar, Space, Tooltip, Image as AntImage, Card } from 'antd'; // Added AntImage, Card
import {
    ArrowLeftOutlined, CheckOutlined, CloseOutlined, SendOutlined, HistoryOutlined,
    SyncOutlined, // Removed PDF specific icons: ZoomInOutlined, ZoomOutOutlined, UndoOutlined, InboxOutlined, DeleteOutlined
} from '@ant-design/icons';
import { getCurrentUser } from '@/utils/api'; // Assuming this exists and works
import axios from 'axios';

// --- Helper: API Request Function (Copied from LetterPdfReviewPage) ---
async function apiRequest<T = any>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const config: RequestInit = { method, headers, credentials: 'include' };
    if (body) { config.body = JSON.stringify(body); }
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}${endpoint}`, config);
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! Status: ${response.status}` };
        try { errorData = await response.json(); } catch (e) { }
        throw new Error(errorData?.message || `HTTP error! Status: ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; } catch (e) { return undefined as T; }
}

// --- Types (Combined and Adapted from both files) ---

// References for data lookups
interface Reference { id: string; name: string; type: string; }
interface DynamicDbData { companies: Array<{ id: string; name: string }>; vendors: Array<{ id: string; name: string }>; contracts: Array<{ id: string; name: string }>; customs: Array<{ id: string; name: string }>; documentTypes: Array<{ id: string; name: string }>; subContractorNames: Array<{ id: string; name: string }>; }

// Template structure
interface TemplateSectionData { id: string; title: string; content: string; }
interface SavedTemplate { id: string; name?: string | null; sections: TemplateSectionData[]; userId: string; createdAt: string; updatedAt: string; }

// Form Data structure (from original LetterReviewPage)
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

// Workflow & User Info (from LetterPdfReviewPage)
enum LetterWorkflowStatus { DRAFT = 'draft', PENDING_REVIEW = 'pending_review', PENDING_APPROVAL = 'pending_approval', APPROVED = 'approved', REJECTED = 'rejected' }
enum LetterReviewerStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected', SKIPPED = 'skipped', REASSIGNED = 'reassigned' }
enum LetterActionType { SUBMIT = 'submit', APPROVE_REVIEW = 'approve_review', REJECT_REVIEW = 'reject_review', REASSIGN_REVIEW = 'reassign_review', FINAL_APPROVE = 'final_approve', FINAL_REJECT = 'final_reject', RESUBMIT = 'resubmit', COMMENT = 'comment', UPLOAD_REVISION = 'upload_revision' } // UPLOAD_REVISION might be less relevant now
interface UserInfo { id: string; firstName?: string | null; lastName?: string | null; email: string; avatar?: string | null; }
interface ActionLog { id: string; userId: string; actionType: string; comment?: string | null; details?: any; createdAt: string; user?: UserInfo | null; }
interface ReviewerStep { id: string; userId: string; sequenceOrder: number; status: string; actedAt?: string | null; reassignedFromUserId?: string | null; user?: UserInfo | null; }

// Main Letter Details Structure (Extended to include template/form data)
interface LetterDetails {
    id: string;
    name?: string | null;
    userId: string;
    workflowStatus: string;
    nextActionById?: string | null;
    // Removed PDF specific fields: signedPdfUrl, originalPdfFileId
    createdAt: string;
    updatedAt: string;
    user?: UserInfo | null;
    letterReviewers?: ReviewerStep[] | null;
    letterActionLogs?: ActionLog[] | null;

    // Added from original LetterReviewPage structure (adjust API response accordingly)
    template: SavedTemplate | null;
    formData: Partial<FormData>; // Use Partial as not all fields might be present initially
    logoUrl: string | null;
    signatureUrl: string | null;
    stampUrl: string | null;
}

interface CurrentUserType { id: string; email: string; firstName?: string | null; lastName?: string | null; avatar?: string | null; }


const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;


// --- Helper: Map Placeholder to FormData Key (from original LetterReviewPage) ---
const getFormFieldKeyFromPlaceholder = (placeholderId: string): keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'> | null => {
    const mapping: { [key: string]: keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'> } = {
        'company-1': 'company', 'date-1': 'date', 'customs-1': 'customs',
        'vendor-1': 'vendor', 'contract-1': 'contract', 'amount-1': 'value',
        'invoice-number': 'invoiceNumber', 'cargo-name': 'cargoName',
        'cargo-description': 'cargoDescription', 'document-type': 'documentType',
        'import-purpose': 'importPurpose', 'request-person': 'requestPerson',
        'request-department': 'requestDepartment', 'person': 'person',
        'subcontractor-name': 'subContractorName', 'subcontract-number': 'subContractNumber',
        // Add any other mappings needed by your templates
    };
    return mapping[placeholderId] as keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'> | null || null;
};


// --- Component: Letter Preview Panel (Adapted from original LetterReviewPage) ---
function LetterPreviewPanelReview({
    template,
    formData,
    dbData,
}: {
    template: SavedTemplate | null;
    formData: FormData; // Use the full FormData here
    dbData: DynamicDbData;
}) {
    const renderContentWithPlaceholders = useCallback((text: string): React.ReactNode => {
        if (!text) return '';
        // Regex to find placeholders like $field-id$
        const parts = text.split(/(\$[a-zA-Z0-9-]+\$)/g);
        return parts.map((part, index) => {
            if (part.match(/^\$[a-zA-Z0-9-]+\$$/)) {
                const fieldId = part.slice(1, -1); // Extract field-id
                const formFieldKey = getFormFieldKeyFromPlaceholder(fieldId);

                if (formFieldKey) {
                    const formValue = formData[formFieldKey]; // Get value from formData
                    let displayValue: string | number | readonly string[] | undefined = formValue;

                    // Map IDs to Names for dropdown fields using dbData
                    const dropdownKeys: (keyof Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>)[] = ['company', 'customs', 'vendor', 'contract', 'documentType', 'subContractorName'];
                    if (dropdownKeys.includes(formFieldKey) && formValue && dbData) {
                        const sourceKey = (formFieldKey === 'documentType' ? 'documentTypes' : formFieldKey === 'subContractorName' ? 'subContractorNames' : `${formFieldKey}s`) as keyof DynamicDbData;
                        const sourceDataArray = dbData[sourceKey] as Array<{ id: string; name: string }> | undefined;
                        const selectedItem = sourceDataArray?.find(item => item.id === formValue);
                        displayValue = selectedItem ? selectedItem.name : `[ID: ${formValue} not found]`; // Indicate if ID not found
                    }

                    // Format date nicely
                    if (formFieldKey === 'date' && displayValue) {
                        try {
                            // Ensure date string is treated as UTC to avoid timezone issues if it's just YYYY-MM-DD
                            displayValue = new Date(displayValue + 'T00:00:00Z').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
                        } catch (e) { console.error("Date formatting error:", e); /* keep original value */ }
                    }

                    // Render the value in a highlighted span
                    return (
                        <span key={index} className="bg-yellow-100 text-yellow-900 px-1 py-0.5 rounded font-medium text-xs mx-0.5 align-baseline">
                            {displayValue || `[${formFieldKey} is empty]`}
                        </span>
                    );
                } else {
                     // Handle special placeholders like signature/stamp if needed differently,
                     // or show an error for unrecognized placeholders.
                     if (fieldId === 'signature' || fieldId === 'stamp') {
                        // These are often handled structurally, not via simple text replacement. Return null or specific component.
                        return null;
                    }
                    return <span key={index} className="text-red-500 font-bold text-xs mx-0.5" title={`Unknown placeholder: ${part}`}>[{fieldId}??]</span>;
                }
            }
            // Handle line breaks within the text part
            const lines = part.split('\n');
            return lines.map((line, lineIndex) => (
                <React.Fragment key={`${index}-${lineIndex}`}>{line}{lineIndex < lines.length - 1 && <br />}</React.Fragment>
            ));
        });
    }, [formData, dbData]); // Dependencies for the callback

    if (!template) {
        return <div className="flex items-center justify-center h-full text-gray-500">Template data is missing. Cannot render preview.</div>;
    }

    // Helper to render a specific template section by its ID
    const renderSection = (sectionId: string, className: string = '') => {
        const section = template.sections.find(s => s.id === sectionId);
        if (!section) return null; // Don't render if section not found
        const contentNode = renderContentWithPlaceholders(section.content);
        // Use whitespace-pre-line to respect line breaks and wrap text
        return <div className={`${className} whitespace-pre-line leading-relaxed`}>{contentNode}</div>;
    };

    // Structure the letter layout using renderSection - This layout is based on the original LetterReviewPage
    return (
        <div className="space-y-4">
            {/* Removed the "Letter Preview" title and save button */}
            <div className="relative bg-white p-8 pr-12 pl-12 rounded-lg shadow border border-gray-200 min-h-[800px] text-sm font-serif leading-relaxed">

                {/* Header Section */}
                <div className="flex justify-between items-start mb-8">
                    <div className="w-24 h-16 flex items-center justify-center bg-gray-100 rounded border flex-shrink-0 overflow-hidden">
                        {formData.logoUrl ? (
                            <AntImage src={formData.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" preview={false}/>
                        ) : (
                            <span className="text-gray-400 text-xs">Logo</span>
                        )}
                    </div>
                    <div className="text-right space-y-1 ml-4">
                        {renderSection('header')}
                        {renderSection('date-value')} {/* Assumes a section named 'date-value' exists */}
                    </div>
                </div>

                {/* Address & Recipient */}
                {renderSection('address', 'mb-6 space-y-1')}
                {renderSection('doc-type-value', 'mb-6')} {/* Assumes 'doc-type-value' section */}
                <div className="mb-6 space-y-1">
                    {/* Example of combining label/value if they are separate sections */}
                    {template.sections.find(s => s.id === 'recipient-label' || s.id === 'recipient-value') && (
                        <div className="flex items-baseline">
                           <span className="w-20 font-medium flex-shrink-0">{renderSection('recipient-label', 'inline-block')}</span>
                           {renderSection('recipient-value')}
                        </div>
                    )}
                     {/* Or render a single 'recipient' section if it contains everything */}
                    {renderSection('recipient')}
                </div>

                {/* Main Content */}
                {renderSection('introduction', 'mb-6')}

                {/* Detailed Info Section (Example Structure) */}
                <div className="space-y-2 mb-8 border-t border-b border-gray-200 py-4">
                     {template.sections.find(s => s.id === 'invoice-number-label' || s.id === 'invoice-number-value') && ( <div className="flex justify-between items-baseline">{renderSection('invoice-number-label', 'inline-block font-semibold')}{renderSection('invoice-number-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'cargo-name-label' || s.id === 'cargo-name-value') && ( <div className="flex justify-between items-baseline">{renderSection('cargo-name-label', 'inline-block font-semibold')}{renderSection('cargo-name-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'cargo-description-label' || s.id === 'cargo-description-value') && ( <div className="flex justify-between items-baseline">{renderSection('cargo-description-label', 'inline-block font-semibold mr-2')}{renderSection('cargo-description-value', 'flex-grow text-right')}</div> )}
                     {template.sections.find(s => s.id === 'subcontractor-label' || s.id === 'subcontractor-value') && ( <div className="flex justify-between items-baseline">{renderSection('subcontractor-label', 'inline-block font-semibold')}{renderSection('subcontractor-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'subcontract-num-label' || s.id === 'subcontract-num-value') && ( <div className="flex justify-between items-baseline">{renderSection('subcontract-num-label', 'inline-block font-semibold')}{renderSection('subcontract-num-value', 'text-right')}</div> )}
                     {template.sections.find(s => s.id === 'customs-value-label' || s.id === 'amount-value') && ( <div className="flex justify-between items-baseline">{renderSection('customs-value-label', 'inline-block font-semibold mr-2')}{renderSection('amount-value', 'text-right')}</div> )}
                </div>

                {/* Footer & Signature/Stamp Area */}
                <div className="mt-12 mb-32">
                    {renderSection('footer')}
                </div>

                {/* Absolute positioned Signature/Stamp Area */}
                <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end h-24">
                    <div className="w-1/2 text-left flex flex-col justify-end">
                         {/* Render signature placeholder text if needed */}
                        <div className="mb-1">
                            {renderSection('signature')}
                        </div>
                        {/* Display the actual signature image */}
                        {formData.signatureUrl && (
                            <div className="h-16">
                                <AntImage
                                    src={formData.signatureUrl}
                                    alt="Signature Preview"
                                    className="max-h-full max-w-[200px] object-contain"
                                    preview={false} // Disable Ant Design's preview on click
                                />
                            </div>
                        )}
                    </div>

                    <div className="w-1/2 flex justify-end items-center">
                         {/* Display the actual stamp image */}
                        {formData.stampUrl && (
                            <div className="w-24 h-24 flex items-center justify-center">
                                <AntImage
                                    src={formData.stampUrl}
                                    alt="Stamp Preview"
                                    className="max-h-full max-w-full object-contain opacity-85"
                                    preview={false} // Disable Ant Design's preview on click
                                />
                            </div>
                        )}
                    </div>
                </div>

            </div> {/* End of letter preview container */}
        </div>
    );
}


// --- Main Page Component ---
export default function LetterHtmlReviewPage() {
    const router = useRouter();
    const params = useParams();
    const letterId = params?.letterId as string | undefined;

    // State from LetterPdfReviewPage (User, Letter Details, Workflow)
    const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
    const [letterDetails, setLetterDetails] = useState<LetterDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isReassignModalVisible, setIsReassignModalVisible] = useState(false);
    const [reassignTargetUserId, setReassignTargetUserId] = useState<string | null>(null);
    const [reassignOptions, setReassignOptions] = useState<UserInfo[]>([]);
    const [actionComment, setActionComment] = useState(''); // For Reject/Reassign
    const [resubmitComment, setResubmitComment] = useState(''); // For Resubmit

    // State needed for HTML rendering (from original LetterReviewPage)
    const [allReferences, setAllReferences] = useState<Reference[]>([]);


    // Fetch Current User
    useEffect(() => {
        const fetchUser = async () => {
            setIsUserLoading(true);
            try {
                const user = await getCurrentUser(); // Assuming this function exists
                setCurrentUser(user);
            } catch (err) {
                console.error("Failed to fetch current user:", err);
                setError("Failed to get user information. Actions may be disabled.");
                setCurrentUser(null);
            } finally {
                setIsUserLoading(false);
            }
        };
        fetchUser();
    }, []);

    // Fetch Letter Details and References
    useEffect(() => {
        if (!letterId) {
            setError("Letter ID is missing from the URL.");
            setIsLoading(false);
            return;
        }
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            setLetterDetails(null); // Reset details on new ID
            setAllReferences([]);   // Reset references
            try {
                // Fetch letter details (ensure API returns template, formData, logoUrl, etc.)
                const details = await apiRequest<LetterDetails>(`/letters/${letterId}`);
                if (!details || !details.template || !details.formData) {
                     // Check if template and formData exist in the response
                     throw new Error('Letter data is incomplete. Template or form data might be missing.');
                }
                setLetterDetails(details);

                // Fetch references (needed for dropdown value lookups)
                // Adjust endpoint if necessary
                const refs = await apiRequest<Reference[]>('/references'); // Example endpoint
                setAllReferences(refs || []);

            } catch (err: any) {
                console.error("Error fetching letter details or references:", err);
                setError(err.message || "An error occurred while loading the letter.");
                setLetterDetails(null);
                setAllReferences([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [letterId]); // Rerun if letterId changes

    // Fetch users for reassignment modal (when opened)
    useEffect(() => {
        if (isReassignModalVisible && letterDetails) {
            const fetchUsers = async () => {
                try {
                    const allUsers = await apiRequest<UserInfo[]>('/users');
                    // Filter out submitter, current reviewers, and current user
                    const currentWorkflowUserIds = new Set(letterDetails.letterReviewers?.map(r => r.userId) ?? []);
                    currentWorkflowUserIds.add(letterDetails.userId); // Submitter
                    if (currentUser) { currentWorkflowUserIds.add(currentUser.id); } // Current viewer

                    const availableUsers = allUsers.filter(user => !currentWorkflowUserIds.has(user.id));
                    setReassignOptions(availableUsers);
                } catch (err: any) {
                    message.error("Failed to load users for reassignment.");
                    setReassignOptions([]);
                }
            };
            fetchUsers();
        }
    }, [isReassignModalVisible, letterDetails, currentUser]);


    // Prepare dbData for rendering (lookup tables from references)
    const dbData = useMemo<DynamicDbData>(() => {
        const data: DynamicDbData = { companies: [], vendors: [], contracts: [], customs: [], documentTypes: [], subContractorNames: [] };
        allReferences.forEach(ref => {
            const item = { id: ref.id, name: ref.name };
            switch (ref.type) { // Assuming reference types match keys needed
                case 'Company': data.companies.push(item); break;
                case 'Vendor Name': data.vendors.push(item); break;
                case 'Contract Number': data.contracts.push(item); break;
                case 'Customs Department': data.customs.push(item); break;
                case 'Document Type': data.documentTypes.push(item); break;
                case 'Sub-Contractor Name': data.subContractorNames.push(item); break;
                // Add other types if needed
            }
        });
        return data;
    }, [allReferences]); // Recalculate when references change


    // Prepare full FormData object for rendering (combining defaults, fetched data, urls)
    const fullFormDataForPreview = useMemo<FormData | null>(() => {
        if (!letterDetails || !letterDetails.formData) return null;

        // Define default structure for FormData
        const defaultFormData: FormData = {
            company: '', date: '', customs: '', person: '', vendor: '', contract: '', value: '', mode: '',
            reference: '', invoiceNumber: '', cargoName: '', cargoDescription: '', documentType: '',
            importPurpose: '', requestPerson: '', requestDepartment: '', declarationNumber: '',
            quantityBillNumber: '', subContractorName: '', subContractNumber: '',
            logoUrl: null, signatureUrl: null, stampUrl: null
        };

        // Merge defaults with fetched data and image URLs
        return {
            ...defaultFormData,
            ...letterDetails.formData, // Spread the potentially partial data from API
            logoUrl: letterDetails.logoUrl,
            signatureUrl: letterDetails.signatureUrl,
            stampUrl: letterDetails.stampUrl,
        };
    }, [letterDetails]); // Recalculate when letterDetails change


    // --- Workflow Logic (Mostly from LetterPdfReviewPage) ---

    const isCurrentUserNextActor = useMemo(() => {
        return !!currentUser && !!letterDetails && letterDetails.nextActionById === currentUser.id;
    }, [currentUser, letterDetails]);

    const canTakeAction = useMemo(() => {
        const status = letterDetails?.workflowStatus;
        const isCorrectStatus = status === LetterWorkflowStatus.PENDING_REVIEW || status === LetterWorkflowStatus.PENDING_APPROVAL;
        return !!letterDetails && isCurrentUserNextActor && isCorrectStatus;
    }, [isCurrentUserNextActor, letterDetails]);

    const isSubmitterOfRejectedLetter = useMemo(() => {
        return !!currentUser && !!letterDetails &&
            letterDetails.workflowStatus === LetterWorkflowStatus.REJECTED &&
            letterDetails.userId === currentUser.id;
    }, [currentUser, letterDetails]);


    // --- Action Handlers (Adapted from LetterPdfReviewPage, removed PDF/signing specifics) ---

    const handleApprove = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction) return;
        setIsActionLoading(true);
        message.loading({ content: 'Processing approval...', key: 'action', duration: 0 });
        try {
            const isFinalApproval = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            const endpoint = isFinalApproval ? `/letters/${letterId}/final-approve-letter` : `/letters/${letterId}/approve-review`;
            // Approval might not need a comment, but include if API expects it
            const payload = { comment: actionComment }; // Use actionComment if approval comments are desired/needed
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Action successful!', key: 'action', duration: 2 });
            setActionComment(''); // Clear comment after use
            router.push('/dashboard/Inbox'); // Or relevant target page
        } catch (apiError: any) {
            message.error({ content: `Failed to process approval: ${apiError.message || 'Unknown error'}`, key: 'action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction) return;
        if (!actionComment.trim()) { // Reject reason is usually mandatory
            message.error("Rejection reason/comment cannot be empty.");
            return;
        }
        setIsActionLoading(true);
        message.loading({ content: 'Processing rejection...', key: 'action', duration: 0 });
        try {
            const isFinalApproval = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            const endpoint = isFinalApproval ? `/letters/${letterId}/final-reject` : `/letters/${letterId}/reject-review`;
            const payload = { reason: actionComment }; // API likely expects 'reason'
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Rejection successful!', key: 'action', duration: 2 });
            setActionComment(''); // Clear comment
            router.push('/dashboard/Inbox');
        } catch (apiError: any) {
            message.error({ content: `Failed to process rejection: ${apiError.message || 'Unknown error'}`, key: 'action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const showReassignModal = () => setIsReassignModalVisible(true);
    const handleReassignCancel = () => setIsReassignModalVisible(false);
    const handleReassignSubmit = async () => {
        if (!letterId || !currentUser?.id || !canTakeAction || !reassignTargetUserId) {
            message.error("Please select a user to reassign to.");
            return;
        }
        setIsActionLoading(true);
        setIsReassignModalVisible(false);
        message.loading({ content: 'Processing reassignment...', key: 'action', duration: 0 });
        try {
            const endpoint = `/letters/${letterId}/reassign`;
            // Include comment as 'reason' if provided
            const payload = { newUserId: reassignTargetUserId, reason: actionComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Reassignment successful!', key: 'action', duration: 2 });
            setReassignTargetUserId(null);
            setActionComment(''); // Clear comment
            router.push('/dashboard/Inbox');
        } catch (apiError: any) {
            message.error({ content: `Failed to process reassignment: ${apiError.message || 'Unknown error'}`, key: 'action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleResubmit = async () => {
        if (!letterId || !currentUser?.id || !isSubmitterOfRejectedLetter) return;
        if (!resubmitComment.trim()) { // Resubmit comment is usually mandatory
            message.error("Resubmission comment cannot be empty.");
            return;
        }
        // Removed all PDF signing and uploading logic
        setIsActionLoading(true);
        message.loading({ content: 'Resubmitting letter...', key: 'resubmit-action', duration: 0 });
        try {
            const endpoint = `/letters/${letterId}/resubmit`;
            // Payload only includes the comment now
            const payload: { comment: string } = { comment: resubmitComment };
            await apiRequest(endpoint, 'POST', payload);
            message.success({ content: 'Letter resubmitted successfully!', key: 'resubmit-action', duration: 2 });
            setResubmitComment(''); // Clear comment
            // Reset any state related to potential file upload if it were added back
            router.push('/dashboard/MyStaff'); // Or relevant page after resubmit
        } catch (apiError: any) {
            message.error({ content: `Failed to resubmit letter: ${apiError.message || 'Unknown error'}`, key: 'resubmit-action', duration: 4 });
        } finally {
            setIsActionLoading(false);
        }
    };

    // --- UI Rendering Helpers (Copied/Adapted from LetterPdfReviewPage) ---

    const renderActionButtons = () => {
        if (isUserLoading) return <Spin size="small" />;

        if (canTakeAction) {
            const isFinalApprovalStep = letterDetails?.workflowStatus === LetterWorkflowStatus.PENDING_APPROVAL;
            return (
                <Space wrap>
                    <Button danger icon={<CloseOutlined />} onClick={handleReject} loading={isActionLoading} disabled={isActionLoading || !actionComment.trim()}> Reject </Button> {/* Disable if no comment */}
                    {!isFinalApprovalStep && (
                        <Button icon={<SendOutlined />} onClick={showReassignModal} loading={isActionLoading} disabled={isActionLoading}> Reassign </Button>
                    )}
                    <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove} loading={isActionLoading} disabled={isActionLoading}>
                        {isFinalApprovalStep ? 'Final Approve' : 'Approve Step'}
                    </Button>
                </Space>
            );
        } else if (isSubmitterOfRejectedLetter) {
            return (
                <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={handleResubmit}
                    loading={isActionLoading}
                    // Disable if no comment OR action is already loading
                    disabled={isActionLoading || !resubmitComment.trim()}
                >
                    Resubmit Letter
                </Button>
            );
        }
        return null; // No actions available for the current user/status
    };

    // Status/Formatting helpers
    const getStatusColor = (status: string): string => { /* ... (same as LetterPdfReviewPage) ... */
        switch (status) {
            case LetterWorkflowStatus.PENDING_REVIEW: case LetterWorkflowStatus.PENDING_APPROVAL: return 'processing';
            case LetterWorkflowStatus.APPROVED: return 'success';
            case LetterWorkflowStatus.REJECTED: return 'error';
            case LetterWorkflowStatus.DRAFT: return 'default';
            default: return 'default';
        }
    };
    const getReviewerStatusColor = (status: string): string => { /* ... (same as LetterPdfReviewPage) ... */
        switch (status) {
            case LetterReviewerStatus.PENDING: return 'default';
            case LetterReviewerStatus.APPROVED: return 'success';
            case LetterReviewerStatus.REJECTED: return 'error';
            case LetterReviewerStatus.REASSIGNED: return 'warning';
            case LetterReviewerStatus.SKIPPED: return 'default';
            default: return 'default';
        }
     };
    const formatStatus = (status: string): string => status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
    const formatActionType = (action: string): string => action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Action';
    const getUserFullName = (user?: UserInfo | null): string => { if (!user) return 'System/Unknown'; return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unnamed User'; };
    const getInitials = (user?: UserInfo | null): string => { if (!user) return 'S'; const first = user.firstName?.[0] || ''; const last = user.lastName?.[0] || ''; return (first + last).toUpperCase() || user.email?.[0].toUpperCase() || '?'; };
    const submitterName = useMemo(() => getUserFullName(letterDetails?.user), [letterDetails]);


    // --- Main Render Function ---
    const renderContent = () => {
        if (isLoading || isUserLoading) {
            return <div className="text-center p-20"><Spin size="large" tip="Loading Letter Details..." /></div>;
        }
        if (error) {
            return <Alert message="Error Loading Letter" description={error} type="error" showIcon closable onClose={() => setError(null)} />;
        }
        if (!letterDetails || !fullFormDataForPreview || !letterDetails.template) { // Check for all required data
            return <Alert message="Incomplete Data" description="Could not load all necessary letter details, template, or form data." type="warning" showIcon />;
        }

        const showResubmitSection = isSubmitterOfRejectedLetter;
        const showActionCommentArea = canTakeAction; // Show comment area only if user can Reject or Reassign

        return (
            <>
                {showResubmitSection && (
                    <Card className="mb-4" title="Resubmit Letter">
                        <Paragraph type="warning">This letter was rejected. Review comments below, add a required comment, and resubmit.</Paragraph>
                        <Space direction="vertical" style={{ width: '100%' }}>
                             {/* Removed the Dragger component for PDF upload */}
                            <TextArea rows={4} placeholder="Comment explaining changes (required)..." value={resubmitComment} onChange={(e) => setResubmitComment(e.target.value)} disabled={isActionLoading} />
                        </Space>
                    </Card>
                )}

                <Row gutter={[16, 16]}>
                    {/* Column 1: Rendered HTML Letter */}
                    <Col xs={24} lg={16}>
                        {/* Call the LetterPreviewPanelReview component */}
                        <LetterPreviewPanelReview
                            template={letterDetails.template}
                            formData={fullFormDataForPreview}
                            dbData={dbData}
                        />
                    </Col>

                    {/* Column 2: Workflow Info & Actions */}
                    <Col xs={24} lg={8}>
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 space-y-4" style={{ display: 'flex', flexDirection: 'column', minHeight: '600px' /* Ensure sidebar has some height */ }}>
                            {/* Workflow Status */}
                            <div>
                                <Title level={5}>Workflow Status</Title>
                                <Tag color={getStatusColor(letterDetails.workflowStatus)}>{formatStatus(letterDetails.workflowStatus)}</Tag>
                                {letterDetails.workflowStatus !== LetterWorkflowStatus.APPROVED && letterDetails.workflowStatus !== LetterWorkflowStatus.REJECTED && letterDetails.nextActionById && (
                                    <Text type="secondary" className="block mt-1">
                                        Waiting for: {getUserFullName(letterDetails.letterReviewers?.find(r => r.userId === letterDetails.nextActionById)?.user)}
                                    </Text>
                                )}
                            </div>

                             {/* Action History */}
                            <div className="flex-grow overflow-hidden flex flex-col">
                                <Title level={5}><HistoryOutlined /> Action History & Comments</Title>
                                <div className="flex-grow overflow-y-auto pr-2 mb-2 border rounded p-2 bg-gray-50 min-h-[200px]"> {/* Added min-height */}
                                    <List
                                        itemLayout="horizontal"
                                        dataSource={letterDetails.letterActionLogs?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? []} // Sort newest first
                                        locale={{ emptyText: "No actions logged yet." }}
                                        renderItem={item => (
                                            <List.Item>
                                                <List.Item.Meta
                                                    avatar={<Avatar src={item.user?.avatar} >{getInitials(item.user)}</Avatar>}
                                                    title={<><Text strong>{formatActionType(item.actionType)}</Text> by <Text>{getUserFullName(item.user)}</Text></>}
                                                    description={
                                                        <>
                                                            <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
                                                            {item.comment && (
                                                                <Paragraph
                                                                    ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
                                                                    className={`mt-1 mb-0 p-1.5 rounded border text-xs ${
                                                                        item.actionType === LetterActionType.REJECT_REVIEW || item.actionType === LetterActionType.FINAL_REJECT
                                                                        ? 'bg-red-50 border-red-200'
                                                                        : 'bg-blue-50 border-blue-200' // Use blue for other comments
                                                                    }`}
                                                                    style={{ whiteSpace: 'pre-wrap' }} // Preserve whitespace/newlines in comment
                                                                >
                                                                    {item.comment}
                                                                </Paragraph>
                                                            )}
                                                        </>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Action Comment Area (for Reject/Reassign) */}
                            {showActionCommentArea && (
                                <div className='mt-auto pt-2 border-t'>
                                    <Title level={5} style={{ marginBottom: '8px' }}>Action Comment / Reason</Title>
                                    <TextArea rows={3} placeholder="Enter reason for rejection or note for reassignment here..." value={actionComment} onChange={(e) => setActionComment(e.target.value)} disabled={isActionLoading} />
                                    <Text type="secondary" className='text-xs mt-1 block'>This comment/reason will be saved when you click Reject or Reassign.</Text>
                                </div>
                            )}

                            {/* Reviewers List */}
                            <div className="pt-2 border-t">
                                <Title level={5} style={{ marginTop: '16px' }}>Reviewers & Approver</Title>
                                <List
                                     size="small"
                                     dataSource={letterDetails.letterReviewers?.sort((a, b) => a.sequenceOrder - b.sequenceOrder) ?? []}
                                     locale={{emptyText: "No reviewers or approver assigned."}}
                                     renderItem={item => (
                                        <List.Item>
                                            <List.Item.Meta
                                                 avatar={<Avatar src={item.user?.avatar} >{getInitials(item.user)}</Avatar>}
                                                 title={<>{item.sequenceOrder === 999 ? 'Approver: ' : `Reviewer ${item.sequenceOrder}: `} {getUserFullName(item.user)}</>}
                                                 description={<Tag color={getReviewerStatusColor(item.status)}>{formatStatus(item.status)}</Tag>}
                                            />
                                        </List.Item>
                                     )}
                                 />
                            </div>
                        </div>
                    </Col>
                </Row>
            </>
        );
    };


    // --- Page Structure (from LetterPdfReviewPage) ---
    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            {/* Header Bar */}
            <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-lg shadow-sm flex-wrap">
                <div className="flex items-center mr-4 mb-2 md:mb-0">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} type="text" aria-label="Go back" className="mr-2" />
                    <Title level={3} className="mb-0 truncate">
                        Review Letter: {letterDetails?.name || (letterId ? `ID ${letterId.substring(0, 8)}...` : '')}
                    </Title>
                </div>
                <div className="flex justify-end flex-grow">
                    {renderActionButtons()} {/* Render Approve/Reject/Reassign/Resubmit buttons */}
                </div>
            </div>

            {/* Info Bar */}
            {!isLoading && letterDetails && (
                <div className="mb-4 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                    Submitted by: <span className="font-semibold">{submitterName}</span> on <span className="font-semibold">{new Date(letterDetails.createdAt).toLocaleDateString('en-CA')}</span>
                    <span className="ml-4 pl-4 border-l border-gray-300">Current Status: <Tag color={getStatusColor(letterDetails.workflowStatus)}>{formatStatus(letterDetails.workflowStatus)}</Tag></span>
                </div>
            )}

            {/* Main Content Area */}
            {renderContent()}

            {/* Reassign Modal */}
            <Modal
                title="Reassign Review Step"
                open={isReassignModalVisible}
                onOk={handleReassignSubmit}
                onCancel={handleReassignCancel}
                confirmLoading={isActionLoading}
                okText="Reassign"
                cancelText="Cancel"
                okButtonProps={{ disabled: !reassignTargetUserId }} // Disable OK if no user selected
            >
                <Paragraph>Select the user to reassign this review step to. The comment/reason should be entered in the main text area before clicking Reassign.</Paragraph>
                <Select
                    showSearch
                    placeholder="Select a user to reassign to"
                    style={{ width: '100%', marginBottom: '10px' }}
                    value={reassignTargetUserId}
                    onChange={(value) => setReassignTargetUserId(value)}
                    filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                    loading={reassignOptions.length === 0 && isReassignModalVisible} // Show loading only when modal is visible and options are empty
                    options={reassignOptions.map(user => ({
                         value: user.id,
                         label: `${getUserFullName(user)} (${user.email})`, // Store full info in label for search
                         key: user.id // Add key prop
                    }))}
                >
                     {/* Options are now passed directly to Select component */}
                </Select>
            </Modal>
        </div>
    );
}
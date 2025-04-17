import axios from 'axios';
import { message } from 'antd';
import { TemplateSectionData } from '@/app/dashboard/CreateForm/page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: string;
  isActive: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  hasPassword?: boolean;
  password?: string | null;
  isSuperUser?: boolean;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorSetupResponse {
  qrCodeUrl: string;
  secret: string;
}

export interface TwoFactorVerifyData {
  token: string;
}

export interface TwoFactorStatus {
  isEnabled: boolean;
}

export interface CheckEmailResponse {
  exists: boolean;
  hasPassword: boolean;
  organization?: {
    id: string;
    name: string;
    domain: string;
  };
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  requiresTwoFactor?: boolean;
}

export interface ApprovalRequest {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  status?: string;
  priority?: string;
  createdBy: {
    name?: string;
    avatar?: string;
  };
}

export interface DocumentRecord {
  id: string;
  title: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  creator: {
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
}

export interface DocumentCabinet {
  id: string;
  name: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  createdBy: {
    name: string;
    avatar: string | null;
  };
}

export interface Space {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  owner?: {
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}


export interface FormattedRecord {
  key: string;
  id: string;
  description: string;
  type: string;
  sentBy: {
    name: string;
    avatar: string;
  };
  sentOn: string;
  priority: string;
  deadlines: string;
  status: string | { label: string; color: string };
  rejectedOn?: string;
  reason?: string;
}

export interface FormattedCabinet {
  key: string;
  id: string;
  description: string;
  type: string;
  sentBy: {
    name: string;
    avatar: string;
  };
  sentOn: string;
  priority: string;
  deadlines: string;
  status: string | { label: string; color: string };
  rejectedOn?: string;
  reason?: string;
}

export interface PendingApproval {
  key: string;
  id: string;
  description: string;
  reference: string;
  priority: string;
  date: string;
  deadline: string;
  sentBy: {
    name: string;
    avatar: string;
  };
}

export interface Group {
  id: string;
  name: string;
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token_w');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const isMagicLinkFlow =
      window.location.href.includes('token=') ||
      window.location.pathname.includes('create-password');

    if (error.response?.status === 401 && !isMagicLinkFlow) {
      localStorage.removeItem('access_token_w');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Daha dəqiq tiplər üçün axios metodlarını override edirik
type AxiosGet<T> = (url: string, config?: any) => Promise<T>;
type AxiosPut<T> = (url: string, data?: any, config?: any) => Promise<T>;
type AxiosPost<T> = (url: string, data?: any, config?: any) => Promise<T>;
type AxiosDelete<T> = (url: string, config?: any) => Promise<T>;

const typedApi = api as unknown as {
  get: AxiosGet<any>;
  put: AxiosPut<any>;
  post: AxiosPost<any>;
  delete: AxiosDelete<any>;
};

// ===============================
// USER-RELATED
// ===============================
export const getCurrentUser = async (): Promise<User> => {
  try {
    return await typedApi.get('/users/me');
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};

export const updateProfile = async (data: UpdateProfileData): Promise<User> => {
  try {
    return await typedApi.put(`/users/me`, data);
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

export const updatePassword = async (data: UpdatePasswordData): Promise<void> => {
  try {
    await typedApi.put(`/users/me/password`, data);
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

export const setup2FA = async (): Promise<TwoFactorSetupResponse> => {
  try {
    return await typedApi.post('/users/me/2fa/setup');
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw error;
  }
};

export const verify2FA = async (data: TwoFactorVerifyData): Promise<void> => {
  try {
    await typedApi.post('/users/me/2fa/verify', data);
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    throw error;
  }
};

export const disable2FA = async (data: TwoFactorVerifyData): Promise<void> => {
  try {
    await typedApi.post('/users/me/2fa/disable', data);
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    throw error;
  }
};

export const get2FAStatus = async (): Promise<TwoFactorStatus> => {
  try {
    return await typedApi.get('/users/me/2fa/status');
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    throw error;
  }
};

export const checkEmail = async (email: string): Promise<CheckEmailResponse> => {
  try {
    return await typedApi.post('/auth/check-email', { email });
  } catch (error) {
    console.error('Error checking email:', error);
    throw error;
  }
};

export const sendMagicLink = async (email: string): Promise<void> => {
  try {
    const response = await typedApi.post('/auth/magic-link', { email });
    return response;
  } catch (error: any) {
    console.error('Error sending magic link:', error.response?.data || error.message);
    throw error;
  }
};

export const verifyMagicLink = async (token: string): Promise<LoginResponse> => {
  try {
    return await typedApi.post('/auth/verify-magic-link', { token });
  } catch (error) {
    console.error('Error verifying magic link:', error);
    throw error;
  }
};

// ===============================
// INBOX/APPROVALS-RELATED
// ===============================
export const getApprovalRequests = async (): Promise<ApprovalRequest[]> => {
  try {
    return await typedApi.get('/approvals');
  } catch (error) {
    console.error('Error fetching approval requests:', error);
    throw error;
  }
};

// export const getMyPendingApprovals = async (): Promise<ApprovalRequest[]> => {
//   try {
//     return await typedApi.get('/approvals/my-pending');
//   } catch (error) {
//     console.error('Error fetching my pending approvals:', error);
//     throw error;
//   }
// };

export const getApprovalsWaitingForMe = async (): Promise<ApprovalRequest[]> => {
  try {
    return await typedApi.get('/approvals/waiting-for-me');
  } catch (error) {
    console.error('Error fetching approvals waiting for me:', error);
    throw error;
  }
};

// ===============================
// RECORDS
// ===============================
export const getAllRecords = async (statusList: string): Promise<DocumentRecord[]> => {
  try {
    return await typedApi.get(`/records?status=${statusList}`);
  } catch (error) {
    console.error('Error fetching all records:', error);
    throw error;
  }
};

export const getRecordsByStatus = async (status: string): Promise<DocumentRecord[]> => {
  try {
    return await typedApi.get(`/records?status=${status}`);
  } catch (error) {
    console.error(`Error fetching records with status ${status}:`, error);
    throw error;
  }
};

export const getMyRecordsByStatus = async (status: string): Promise<DocumentRecord[]> => {
  try {
    return await typedApi.get(`/records/my-records?status=${status}`);
  } catch (error) {
    console.error(`Error fetching my records with status ${status}:`, error);
    throw error;
  }
};

export const getRecordsWaitingForMyApproval = async (): Promise<DocumentRecord[]> => {
  try {
    return await typedApi.get('/records/waiting-for-my-approval');
  } catch (error) {
    console.error('Error fetching records waiting for my approval:', error);
    throw error;
  }
};

export const deleteRecord = async (recordId: string): Promise<void> => {
  try {
    await typedApi.delete(`/records/${recordId}`);
  } catch (error) {
    console.error('Error deleting record:', error);
    throw error;
  }
};

// **Yeni**: approveRecord
export const approveRecord = async (recordId: string): Promise<void> => {
  try {
    await typedApi.put(`/records/${recordId}/approve`, {
      id: recordId,
      type: 'record'
    });
  } catch (error) {
    console.error('Error approving record:', error);
    throw error;
  }
};

// ===============================
// SPACES
// ===============================
export const getSpacesByStatus = async (status: string): Promise<Space[]> => {
  try {
    return await typedApi.get(`/spaces/getByStatus?status=${status}`);
  } catch (error) {
    console.error(`Error fetching spaces with status ${status}:`, error);
    throw error;
  }
};

export const getMySpacesByStatus = async (status: string): Promise<Space[]> => {
  try {
    return await typedApi.get(`/spaces/my-spaces?status=${status}`);
  } catch (error) {
    console.error(`Error fetching my spaces with status ${status}:`, error);
    throw error;
  }
};

export const getSpacesWaitingForMyApproval = async (): Promise<Space[]> => {
  try {
    return await typedApi.get('/spaces/waiting-for-my-approval');
  } catch (error) {
    console.error('Error fetching spaces waiting for my approval:', error);
    throw error;
  }
};

export const deleteSpace = async (spaceId: string): Promise<void> => {
  try {
    await typedApi.delete(`/spaces/${spaceId}`);
  } catch (error) {
    console.error('Error deleting space:', error);
    throw error;
  }
};

// **Yeni**: approveSpace
export const approveSpace = async (spaceId: string): Promise<void> => {
  try {
    // Bu route hal-hazırda "/approvals/:id/approve" şəklindədir
    await typedApi.post(`/approvals/${spaceId}/approve`, {
      type: 'space',
      comment: 'Approved'
    });
  } catch (error) {
    console.error('Error approving space:', error);
    throw error;
  }
};

// ===============================
// CABINETS
// ===============================
export const getMyCabinetsByStatus = async (status: string): Promise<any[]> => {
  try {
    return await typedApi.get(`/cabinets/my-cabinets?status=${status}`);
  } catch (error) {
    console.error(`Error fetching my cabinets with status ${status}:`, error);
    throw error;
  }
};

export const getCabinetsWaitingForMyApproval = async (): Promise<any[]> => {
  try {
    return await typedApi.get('/cabinets/waiting-for-my-approval');
  } catch (error) {
    console.error('Error fetching cabinets waiting for my approval:', error);
    throw error;
  }
};

export const deleteCabinet = async (cabinetId: string): Promise<void> => {
  try {
    await typedApi.delete(`/cabinets/${cabinetId}`);
  } catch (error) {
    console.error('Error deleting cabinet:', error);
    throw error;
  }
};

// **Yeni**: approveCabinet
export const approveCabinet = async (cabinetId: string): Promise<void> => {
  try {
    // Hal-hazırda POST /cabinets/:id/approve
    await typedApi.post(`/cabinets/${cabinetId}/approve`);
  } catch (error) {
    console.error('Error approving cabinet:', error);
    throw error;
  }
};

// ===============================
// Helper functions for transforming data
// ===============================
export const formatRecord = (record: DocumentRecord): FormattedRecord => {
  return {
    key: record.id,
    id: record.id,
    description: record.title,
    type: 'Record',
    sentBy: {
      name: `${record.creator.firstName} ${record.creator.lastName}`,
      avatar: record.creator.avatar || '/images/avatar.png'
    },
    sentOn: new Date(record.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    priority: record.priority || 'Med',
    deadlines: new Date(record.createdAt).toLocaleDateString(),
    status: record.status,
    rejectedOn: record.status === 'rejected' ? new Date(record.updatedAt).toLocaleDateString() : undefined,
    reason: record.rejectionReason || undefined
  };
};

export const formatSpace = (space: Space): FormattedRecord => {
  return {
    key: space.id,
    id: space.id,
    description: space.name,
    type: 'Space',
    sentBy: {
      name: space.owner ? `${space.owner.firstName} ${space.owner.lastName}` : 'Unknown User',
      avatar: space.owner?.avatar || '/images/avatar.png'
    },
    sentOn: new Date(space.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    priority: 'Med',
    deadlines: new Date(space.createdAt).toLocaleDateString(),
    status: space.status,
    rejectedOn: space.status === 'rejected' ? new Date(space.updatedAt).toLocaleDateString() : undefined,
    reason: space.rejectionReason || 'No reason provided'
  };
};

export const formatCabinet = (cabinet: DocumentCabinet): FormattedCabinet => {
  
  return {
    key: cabinet.id,
    id: cabinet.id,
    description: cabinet.name,
    type: 'Cabinet',
    sentBy: {
      name: `${cabinet.createdBy.name}`,
      avatar: cabinet.createdBy.avatar || '/images/avatar.png'
    },
    sentOn: new Date(cabinet.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    priority: cabinet.priority || 'Med',
    deadlines: new Date(cabinet.createdAt).toLocaleDateString(),
    status: cabinet.status,
    rejectedOn: cabinet.status === 'rejected' ? new Date(cabinet.createdAt).toLocaleDateString() : 'undefined',
    reason: cabinet.rejectionReason || undefined
  };
};

export const formatSpaceAsPendingApproval = (space: Space): PendingApproval => {
  return {
    key: space.id,
    id: space.id,
    description: `Space: ${space.name || 'Unnamed Space'}`,
    reference: space.id ? space.id.slice(0, 8) : 'N/A',
    priority: 'Medium',
    date: space.createdAt
      ? new Date(space.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A',
    deadline: space.updatedAt
      ? new Date(space.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A',
    sentBy: {
      name: space.owner ? `${space.owner.firstName || 'Unknown'} ${space.owner.lastName || 'User'}` : 'Unknown User',
      avatar: space.owner?.avatar || '/images/avatar.png'
    }
  };
};

export const formatRecordAsPendingApproval = (record: DocumentRecord): PendingApproval => {
  return {
    key: record.id,
    id: record.id,
    description: record.title,
    reference: record.id.slice(0, 8),
    priority: record.priority || 'Medium',
    date: new Date(record.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    deadline: new Date(record.updatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    sentBy: {
      name: `${record.creator.firstName} ${record.creator.lastName}`,
      avatar: record.creator.avatar || '/images/avatar.png'
    }
  };
};

export const formatApprovalRequest = (item: ApprovalRequest): FormattedRecord => {
  return {
    key: item.id,
    id: item.id,
    description:
      item.type === 'cabinet'
        ? `New cabinet creation request: ${item.name}`
        : item.type === 'space'
        ? `New space creation request: ${item.name}`
        : `New request: ${item.name}`,
    type: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    sentBy: {
      name: item.createdBy.name || 'Unknown',
      avatar: item.createdBy.avatar || '/images/avatar.png'
    },
    sentOn: new Date(item.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    priority: item.priority || 'Med',
    deadlines: new Date(item.createdAt).toLocaleDateString(),
    status: item.status || 'pending'
  };
};

export const formatCabinetAsPendingApproval = (cabinet: any): PendingApproval => {
  return {
    key: cabinet.id,
    id: cabinet.id,
    description: `Cabinet: ${cabinet.name}`,
    reference: cabinet.id.slice(0, 8),
    priority: cabinet.priority || 'Med',
    date: new Date(cabinet.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    deadline: new Date(cabinet.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    sentBy: {
      name: cabinet.createdBy?.name || 'Unknown User',
      avatar: cabinet.createdBy?.avatar || '/images/avatar.png'
    }
  };
};

export const fetchSuperUsers = async (): Promise<User[]> => {
  try {
    return await typedApi.get('/users/superusers');
  } catch (error) {
    console.error('Error fetching super users:', error);
    throw error;
  }
};

export const fetchGroups = async (organizationId: string): Promise<Group[]> => {
  try {
    return await typedApi.get(`/groups/organization/${organizationId}`);
  } catch (error) {
    console.error('Error fetching groups:', error);
    throw error;
  }
};

export const fetchUserOrganization = async (): Promise<any> => {
  try {
    const userData = await typedApi.get('/users/me');
    const organization = await typedApi.get(`/organizations/findDomainByUserId/${userData.id}`);
    return organization;
  } catch (error) {
    console.error('Error fetching user organization:', error);
    throw error;
  }
};

export const fetchUsers = async (): Promise<User[]> => {
  try {
    return await typedApi.get('/spaces/available-users');
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getCurrentUserStatus = async (): Promise<User> => {
  try {
    return await typedApi.get('/users/me/checkAllTables');
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};



interface SaveTemplatePayload {
  sections: TemplateSectionData[];
  name?: string; // Şablon adı (opsional)
}

interface UpdateTemplatePayload {
  sections: TemplateSectionData[];
  name?: string; // Şablon adı (opsional)
}

interface SavedTemplate {
    id: string;
    name?: string;
    sections: TemplateSectionData[];
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export const saveTemplate = async (payload: SaveTemplatePayload): Promise<SavedTemplate> => {
  try {
    console.log('saveTemplate called with payload:', JSON.stringify(payload, null, 2));
    
    // API çağrışı - əvvəl debugging logları əlavə edirik
    const response = await typedApi.post('/templates', payload);
    
    // Ətraflı response analizi
    console.log('Template saved successfully, API response:', response);
    
    // Əgər response undefined və ya null olsa
    if (!response) {
      throw new Error('API-dən cavab gəlmədi.');
    }
    
    return response; 
  } catch (error) {
    console.error('Error saving template:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      throw new Error(error.response.data.error || 'Şablonu yadda saxlayarkən xəta baş verdi.');
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Bilinməyən xəta baş verdi.');
    }
  }
};

/**
 * İstifadəçinin bütün şablonlarını qaytarır
 */
export const getTemplates = async (): Promise<SavedTemplate[]> => {
  try {
    return await typedApi.get('/templates');
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

/**
 * ID ilə şablonu qaytarır
 */
export const getTemplateById = async (id: string): Promise<SavedTemplate> => {
  try {
    return await typedApi.get(`/templates/${id}`);
  } catch (error) {
    console.error(`Error fetching template with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Şablonu yeniləyir
 */
export const updateTemplate = async (id: string, payload: UpdateTemplatePayload): Promise<SavedTemplate> => {
  try {
    console.log(`updateTemplate called for template ${id} with payload:`, JSON.stringify(payload, null, 2));
    
    const response = await typedApi.put(`/templates/${id}`, payload);
    
    console.log('Template updated successfully, API response:', response);
    
    if (!response) {
      throw new Error('API-dən cavab gəlmədi.');
    }
    
    return response;
  } catch (error) {
    console.error(`Error updating template with ID ${id}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      throw new Error(error.response.data.error || 'Şablonu yeniləyərkən xəta baş verdi.');
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Bilinməyən xəta baş verdi.');
    }
  }
};

/**
 * Şablonu silir
 */
export const deleteTemplate = async (id: string): Promise<void> => {
  try {
    await typedApi.delete(`/templates/${id}`);
  } catch (error) {
    console.error(`Error deleting template with ID ${id}:`, error);
    throw error;
  }
};


// --- Letter API Functions ---

interface SaveLetterPayload {
  templateId: string;
  formData: LetterFormData;
  name?: string | null;
}

interface LetterFormData { company: string; date: string; customs: string; person: string; vendor: string; contract: string; value: string; mode: string; reference: string; /* logo: string; REMOVED */ invoiceNumber: string; cargoName: string; cargoDescription: string; documentType: string; importPurpose: string; requestPerson: string; requestDepartment: string; declarationNumber: string; quantityBillNumber: string; subContractorName: string; subContractNumber: string; logoUrl?: string | null; signatureUrl?: string | null; stampUrl?: string | null; }
interface SavedLetter { id: string; name?: string | null; templateId: string; userId: string; formData: Omit<LetterFormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>; logoUrl?: string | null; signatureUrl?: string | null; stampUrl?: string | null; createdAt: string; updatedAt: string; template?: { id: string; name?: string | null; }; user?: { id: string; firstName?: string; lastName?: string; email?: string; }; }
interface Reference { id: string; name: string; type: string; }
interface UploadResponse { key: string; url: string; }
interface FormDataCore { [key: string]: any; }

export interface LetterDetailsApiResponse {
  id: string;
  name: string | null;
  formData: Omit<FormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>;
  logoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  status: string;
  template: SavedTemplate | null;
  user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export const getReferences = async (): Promise<Reference[]> => {
  try {
    const response = await typedApi.get('/references');
    return response || []; 
  } catch (error) {
    console.error('Error in getReferences:', error);
    throw new Error('Referans məlumatlarını yükləmək mümkün olmadı.');
  }
};


export const getLetterById = async (letterId: string): Promise<LetterDetailsApiResponse> => {
  if (!letterId) {
    console.error('getLetterById called without letterId');
    throw new Error('Letter ID is required.');
  }

  try {
    console.log(`API Call: GET /letters/${letterId}`);
    const response = await typedApi.get(`/letters/${letterId}`);
    console.log(`API Response (getLetterById for ${letterId}):`, response);

    if (!response) {
      throw new Error('API returned no response when fetching letter details.');
    }

    if (!response.id || !response.formData || !response.template) {
         console.warn(`Letter data for ${letterId} might be incomplete:`, response);
    }

    return response;

  } catch (error) {
    console.error(`Error in getLetterById for ID ${letterId}:`, error);

    let errorMsg = 'Məktub detallarını yükləyərkən xəta baş verdi.';

    if (axios.isAxiosError(error)) {
        if (error.response) {
            errorMsg = error.response.data?.error || errorMsg;
            console.error('Backend Error:', error.response.status, error.response.data);
             if (error.response.status === 404) {
                 errorMsg = 'Letter not found or access denied.';
             } else if (error.response.status === 401 || error.response.status === 403) {
                 errorMsg = 'Authentication failed or access denied.';
             }
        } else if (error.request) {
            errorMsg = 'Could not connect to the server. Please check your network.';
        }
    } else if (error instanceof Error) {
        errorMsg = error.message;
    }

    message.error(errorMsg);
    throw new Error(errorMsg);
  }
};
export const saveLetter = async (payload: SaveLetterPayload): Promise<SavedLetter> => {
  try {
    console.log('API Call: POST /letters with payload:', payload); 
    const response = await typedApi.post('/letters', payload);
    console.log('API Response (saveLetter):', response);
    if (!response) throw new Error('API returned no response when saving letter.');
    return response;
  } catch (error) {
    console.error('Error in saveLetter:', error);
    if (axios.isAxiosError(error) && error.response) {
       throw new Error(error.response.data?.error || 'Məktubu yadda saxlayarkən xəta baş verdi.');
    }
    throw new Error('Məktubu yadda saxlayarkən naməlum xəta baş verdi.');
  }
};


export const uploadImage = async (file: File, type: 'logo' | 'signature' | 'stamp'): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('image', file);

  try {
      console.log(`API Call: POST /uploads/image?type=${type}`);
      const response = await typedApi.post(`/uploads/image?type=${type}`, formData, {
          headers: {
               'Content-Type': 'multipart/form-data',
          }
      });
      console.log('API Response (uploadImage):', response);
      if (!response || !response.url || !response.key) {
          throw new Error('Invalid response received from image upload API.');
      }
      return response as UploadResponse;
  } catch (error) {
      console.error(`Error in uploadImage for type ${type}:`, error);
       if (axios.isAxiosError(error) && error.response) {
           console.error("Upload API Error Response:", error.response.data);
           throw new Error(error.response.data?.error || `Şəkil (${type}) yüklənərkən xəta baş verdi.`);
       }
      throw new Error(`Şəkil (${type}) yüklənərkən naməlum xəta baş verdi.`);
  }
};


export interface SharedTemplateData extends SavedTemplate {
  creator?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      avatar?: string | null;
  };
}

export const fetchSharedTemplates = async (): Promise<SharedTemplateData[]> => {
  const endpoint = '/templates/shared-with-me';
  try {
    
    const responseData = await typedApi.get(endpoint);
    console.log(`API Response (fetchSharedTemplates):`, responseData);
    if (!responseData) {
        console.warn(`API call to ${endpoint} returned undefined/null after interceptor.`);
        throw new Error('Paylaşılan şablonları çəkərkən serverdən cavab alınmadı.');
    }

    if (!Array.isArray(responseData)) {
        console.error(`Invalid data format received from ${endpoint}. Expected array, got:`, responseData);
        throw new Error('Serverdən paylaşılan şablonlar üçün gözlənilməz məlumat formatı alındı.');
    }

    return responseData as SharedTemplateData[];

  } catch (error) {
    // The error might have already been processed by the response interceptor (e.g., for 401)
    console.error(`Error executing fetchSharedTemplates (${endpoint}):`, error);

    if (error instanceof Error) {
        throw error;
    } else {
        // Fallback for non-standard errors
        throw new Error('Paylaşılan şablonlar çəkilərkən naməlum xəta baş verdi.');
    }
  }
};


export const getTemplateDetailsForUser = async (id: string): Promise<SavedTemplate> => {
  const endpoint = `/templates/${id}/shared`; // Use the dedicated 'shared' endpoint
  try {
    console.log(`API Call: GET ${endpoint}`);
    const responseData = await typedApi.get(endpoint);

    if (!responseData) {
       // Should ideally be caught by axios interceptor if it's a network/server issue resulting in no data
       console.warn(`API call to ${endpoint} returned undefined/null after interceptor.`);
       throw new Error(`API sorğusu (${endpoint}) cavab qaytarmadı.`);
    }
    // Add any necessary validation if the backend might return non-template data on success
    return responseData as SavedTemplate; // Cast/assume structure matches

  } catch (error) {
    console.error(`Error fetching template details (shared check) for ID ${id} via ${endpoint}:`, error);

    // Handle errors potentially processed by the interceptor
    if (axios.isAxiosError(error) && error.response) {
         // Interceptor likely handles 401 redirect, but we catch other errors
         if (error.response.status !== 401) {
             const backendError = error.response.data?.error || error.response.data?.message;
             let userMessage = backendError || 'Şablon detalları çəkilərkən xəta baş verdi.';

             // Make messages more specific based on backend response if possible
             if (error.response.status === 404 || (backendError && backendError.includes('tapılmadı'))) {
                userMessage = 'Şablon tapılmadı.';
             } else if (error.response.status === 403 || (backendError && backendError.includes('icazəniz yoxdur'))) {
                userMessage = 'Bu şablona baxmaq üçün icazəniz yoxdur.';
             }
             throw new Error(`${userMessage} (Status: ${error.response.status})`);
         } else {
             // Rethrow 401 for clarity, though interceptor might have already acted
             throw new Error('İcazəniz yoxdur və ya sessiyanız bitib.');
         }
    } else if (error instanceof Error) {
         // Rethrow errors originating before the request or non-axios errors
         throw error;
    } else {
        // Fallback
        throw new Error('Şablon detalları çəkilərkən naməlum xəta baş verdi.');
    }
  }
}

  export const getLettersPendingMyReview = async (): Promise<any[]> => {
    try {
        console.log('API Call: GET /letters/pending-review');
        const response = await typedApi.get('/letters/pending-review');
        console.log('API Response (getLettersPendingMyReview):', response);
        if (!response) {
            throw new Error('API returned no response when fetching pending review letters.');
        }
        return response; // Assuming the backend returns an array of letter objects
    } catch (error) {
        console.error('Error in getLettersPendingMyReview:', error);
        const errorMsg = axios.isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : error instanceof Error ? error.message : 'Mənim təsdiqimi gözləyən məktubları yükləyərkən xəta baş verdi.';
        message.error(errorMsg); // Show error to the user
        throw new Error(errorMsg); // Re-throw for component handling if needed
    }
  };


  export interface LetterCommentData {
    id: string;
    letterId: string;
    userId: string;
    message: string;
    type: 'comment' | 'rejection' | 'approval' | 'system' | 'update';
    createdAt: string; // ISO Date string
    updatedAt: string; // ISO Date string
    user?: { // Details of the commenter
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        avatar?: string | null;
    };
}


export const getLetterComments = async (letterId: string): Promise<LetterCommentData[]> => {
  if (!letterId) throw new Error('Letter ID is required to fetch comments.');
  try {
    console.log(`API Call: GET /letters/${letterId}/comments`);
    const response = await typedApi.get(`/letters/${letterId}/comments`);
    return (response || []) as LetterCommentData[]; // Ensure array return
  } catch (error) {
    console.error(`Error fetching comments for letter ${letterId}:`, error);
    message.error('Failed to load comments.');
    throw error; // Re-throw
  }
};


export const addLetterComment = async (letterId: string, message: string, type?: LetterCommentData): Promise<LetterCommentData> => {
  if (!letterId || !message) throw new Error('Letter ID and message are required to add a comment.');
  try {
    console.log(`API Call: POST /letters/${letterId}/comments`);
    const payload = { message, type: type || 'comment' };
    const newComment = await typedApi.post(`/letters/${letterId}/comments`, payload);
    return newComment as LetterCommentData;
  } catch (error) {
     console.error(`Error adding comment for letter ${letterId}:`, error);
     let errorMsg = 'Şərh əlavə edilərkən xəta baş verdi.';
     if (axios.isAxiosError(error) && error.response) {
       errorMsg = error.response.data?.error || errorMsg;
     } else if (error instanceof Error) {
       errorMsg = error.message;
     }
     
     throw new Error('Paylaşılan şablonlar çəkilərkən naməlum xəta baş verdi.');
  }
};


export default api;
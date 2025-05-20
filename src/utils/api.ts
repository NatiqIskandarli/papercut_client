import axios from 'axios';
import { message } from 'antd';
//import { TemplateSectionData } from '@/app/dashboard/CreateForm/page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// Track if a token refresh is in progress
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  config: any;
}> = [];

// Process the queue of failed requests
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  
  failedQueue = [];
};

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
  company?: string;
  timeZone?: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  timeZone?: string;
  avatar?: string;
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

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    
    const isMagicLinkFlow =
      typeof window !== 'undefined' &&
      (window.location.href.includes('token=') ||
      window.location.pathname.includes('create-password'));
    
    // Check if we're on the login page already
    const isLoginPage = 
      typeof window !== 'undefined' && 
      window.location.pathname.includes('login');
      
    console.error('API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    });

    // Handle token refresh when token is expired (and not already refreshing)
    if (error.response?.status === 401 && 
        !originalRequest._retry && 
        !originalRequest.url?.includes('/auth/refresh') && 
        !isMagicLinkFlow && 
        !isLoginPage) {
      
      if (isRefreshing) {
        // If refresh is in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('Attempting to refresh token...');
        // Call refresh token endpoint (the server should use HTTP-only cookies)
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
          withCredentials: true
        });
        
        // Process queued requests
        processQueue(null, response.data.accessToken);
        console.log('Token refreshed successfully');
        
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, process queue with error and redirect to login
        processQueue(refreshError, null);
        console.log('Token refresh failed, redirecting to login');
        
        // Clear cookies when auth fails
        if (typeof window !== 'undefined') {
          // Clear any remaining localStorage just in case
          localStorage.removeItem('access_token_w');
          
          // Use Cookies module to remove it client-side
          import('js-cookie').then(Cookies => {
            Cookies.default.remove('access_token_w');
            
            // Only redirect if we're not already on the login page
            if (!isLoginPage) {
              // Save the current URL to return to after login
              const currentPath = window.location.pathname;
              window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
            }
          });
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // For non-token related 401 errors or if refresh failed
    if (error.response?.status === 401 && !isMagicLinkFlow && !isLoginPage) {
      console.log('Authentication error, redirecting to login');
      
      // Clear cookies when auth fails
      if (typeof window !== 'undefined') {
        // Clear any remaining localStorage just in case
        localStorage.removeItem('access_token_w');
        
        // Use Cookies module to remove it client-side
        import('js-cookie').then(Cookies => {
          Cookies.default.remove('access_token_w');
          
          // Only redirect if we're not already on the login page
          if (!isLoginPage) {
            // Save the current URL to return to after login
            const currentPath = window.location.pathname;
            window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
          }
        });
      }
    }
    return Promise.reject(error);
  }
);

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

export const logoutUser = async (): Promise<void> => {
    try {
        await typedApi.post('/auth/logout');
    } catch (error) {
        console.error('Logout error:', error);
        // Even if backend logout fails, proceed with client-side cleanup
        // Throwing error might prevent redirection in handleLogout
        // throw error;
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

export const getApprovalsWaitingForMe = async (): Promise<ApprovalRequest[]> => {
  try {
    return await typedApi.get('/approvals/waiting-for-me');
  } catch (error) {
    console.error('Error fetching approvals waiting for me:', error);
    throw error;
  }
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
  content?: string;
  name?: string;
}

interface UpdateTemplatePayload {
  content?: string;
  name?: string;
}

interface SavedTemplate {
    id: string;
    name?: string;
    content?: string | '';
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export const saveTemplate = async (payload: SaveTemplatePayload): Promise<SavedTemplate> => {
  try {
    console.log('saveTemplate called with payload:', JSON.stringify(payload, null, 2));
    const response = await typedApi.post('/templates', payload);
    console.log('Template saved successfully, API response:', response);
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

export const getTemplates = async (): Promise<SavedTemplate[]> => {
  try {
    return await typedApi.get('/templates');
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

export const getTemplateById = async (id: string): Promise<SavedTemplate> => {
  try {
    return await typedApi.get(`/templates/${id}`);
  } catch (error) {
    console.error(`Error fetching template with ID ${id}:`, error);
    throw error;
  }
};

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

export const deleteTemplate = async (id: string): Promise<void> => {
  try {
    await typedApi.delete(`/templates/${id}`);
  } catch (error) {
    console.error(`Error deleting template with ID ${id}:`, error);
    throw error;
  }
};

interface SaveLetterPayload {
  templateId: string;
  formData: LetterFormData;
  name?: string | null;
}

interface LetterFormData { company: string; date: string; customs: string; person: string; vendor: string; contract: string; value: string; mode: string; reference: string; invoiceNumber: string; cargoName: string; cargoDescription: string; documentType: string; importPurpose: string; requestPerson: string; requestDepartment: string; declarationNumber: string; quantityBillNumber: string; subContractorName: string; subContractNumber: string; logoUrl?: string | null; signatureUrl?: string | null; stampUrl?: string | null; }
interface SavedLetter { id: string; name?: string | null; templateId: string; userId: string; formData: Omit<LetterFormData, 'logoUrl' | 'signatureUrl' | 'stampUrl'>; logoUrl?: string | null; signatureUrl?: string | null; stampUrl?: string | null; createdAt: string; updatedAt: string; template?: { id: string; name?: string | null; }; user?: { id: string; firstName?: string; lastName?: string; email?: string; }; }
interface Reference { id: string; name: string; type: string; }
interface UploadResponse { key: string; url: string; }
interface FormDataCore { [key: string]: any; }

interface FormDataLet {
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
interface UserInfo { id: string; firstName?: string | null; lastName?: string | null; email: string; avatar?: string | null; }
interface ReviewerStep { id: string; userId: string; sequenceOrder: number; status: string; actedAt?: string | null; reassignedFromUserId?: string | null; user?: UserInfo | null; }
interface ActionLog { id: string; userId: string; actionType: string; comment?: string | null; details?: any; createdAt: string; user?: UserInfo | null; }

export interface LetterDetailsApiResponse {
  id: string;
  name: string | null;
  formData: Omit<FormDataLet, 'logoUrl' | 'signatureUrl' | 'stampUrl'>;
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
      avatar: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  workflowStatus: LetterWorkflowStatus;
  currentStepIndex?: number | null;
  nextActionById?: string | null;
  letterReviewers: ReviewerStep[] | null;
  letterActionLogs: ActionLog[] | null;
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


export const uploadImage = async (file: File, type: 'logo' | 'signature' | 'stamp' | 'avatar'): Promise<UploadResponse> => {
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
    console.error(`Error executing fetchSharedTemplates (${endpoint}):`, error);

    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error('Paylaşılan şablonlar çəkilərkən naməlum xəta baş verdi.');
    }
  }
};


export const getTemplateDetailsForUser = async (id: string): Promise<SavedTemplate> => {
  const endpoint = `/templates/${id}/shared`;
  try {
    console.log(`API Call: GET ${endpoint}`);
    const responseData = await typedApi.get(endpoint);

    if (!responseData) {
       console.warn(`API call to ${endpoint} returned undefined/null after interceptor.`);
       throw new Error(`API sorğusu (${endpoint}) cavab qaytarmadı.`);
    }
    return responseData as SavedTemplate;

  } catch (error) {
    console.error(`Error fetching template details (shared check) for ID ${id} via ${endpoint}:`, error);

    if (axios.isAxiosError(error) && error.response) {
         if (error.response.status !== 401) {
             const backendError = error.response.data?.error || error.response.data?.message;
             let userMessage = backendError || 'Şablon detalları çəkilərkən xəta baş verdi.';

             if (error.response.status === 404 || (backendError && backendError.includes('tapılmadı'))) {
                userMessage = 'Şablon tapılmadı.';
             } else if (error.response.status === 403 || (backendError && backendError.includes('icazəniz yoxdur'))) {
                userMessage = 'Bu şablona baxmaq üçün icazəniz yoxdur.';
             }
             throw new Error(`${userMessage} (Status: ${error.response.status})`);
         } else {
             throw new Error('İcazəniz yoxdur və ya sessiyanız bitib.');
         }
    } else if (error instanceof Error) {
         throw error;
    } else {
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
        return response;
    } catch (error) {
        console.error('Error in getLettersPendingMyReview:', error);
        const errorMsg = axios.isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : error instanceof Error ? error.message : 'Mənim təsdiqimi gözləyən məktubları yükləyərkən xəta baş verdi.';
        message.error(errorMsg);
        throw new Error(errorMsg);
    }
  };

  export enum LetterWorkflowStatus {
    DRAFT = 'draft',
    PENDING_REVIEW = 'pending_review',
    PENDING_APPROVAL = 'pending_approval',
    APPROVED = 'approved',
    REJECTED = 'rejected'
  }
  interface PendingLetter {
    id: string;
    name: string | null;
    workflowStatus: LetterWorkflowStatus;
    createdAt: string;
    updatedAt: string;
    originalPdfFileId: string | null;
    template?: { id: string; name: string | null };
    user?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        avatar?: string;
    };
    letterActionLogs?: Array<{ comment: string | null; createdAt: string }> | null;
  }

  export const getLettersPendingMyAction = async (): Promise<PendingLetter[]> => {
    try {
      const response = await typedApi.get('/letters/pending-my-action');


        if (!response) {
            throw new Error('API returned no response when fetching pending action letters.');
        }
        return response as PendingLetter[];
    } catch (error) {
        console.error('Error in getLettersPendingMyAction:', error);
        const errorMsg = axios.isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : error instanceof Error ? error.message : 'Mənim təsdiqimi/nəzərdən keçirməmi gözləyən məktubları yükləyərkən xəta baş verdi.';
        message.error(errorMsg);
        throw new Error(errorMsg);
    }
};

  export const getMyRejectedLettersApi = async (): Promise<any[]> => {
    try {
        console.log('API Call: GET /letters/my-rejected');
        const response = await typedApi.get('/letters/my-rejected');
        console.log('API Response (my-rejected):', response);
        if (!response) {
            throw new Error('API returned no response when fetching rejected review letters.');
        }
        return response;
    } catch (error) {
        console.error('Error in my-rejected:', error);
        const errorMsg = axios.isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : error instanceof Error ? error.message : 'Mənim rejected gözləyən məktubları yükləyərkən xəta baş verdi.';
        message.error(errorMsg);
        throw new Error(errorMsg);
    }
  };


  export interface LetterCommentData {
    id: string;
    letterId: string;
    userId: string;
    message: string;
    type: 'comment' | 'rejection' | 'approval' | 'system' | 'update';
    createdAt: string;
    updatedAt: string;
    user?: {
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
    return (response || []) as LetterCommentData[];
  } catch (error) {
    console.error(`Error fetching comments for letter ${letterId}:`, error);
    message.error('Failed to load comments.');
    throw error;
  }
};


export const addLetterComment = async (letterId: string, message: string, type?: LetterCommentData['type']): Promise<LetterCommentData> => {
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
import axios from 'axios';
import { message } from 'antd';
import { API_URL } from '@/app/config/index';

class ApiService {
  // Remove getAuthHeaders and getAuthToken, always use cookies

  async performSearch(params: { page?: number; type?: string; query?: string; criteria?: any }) {
    try {
      // Use axios withCredentials to send cookies
      const response = await axios.post(`${API_URL}/search`, params, { withCredentials: true });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Remove isAuthenticated check based on localStorage

  private async apiCall(endpoint: string, options: RequestInit = {}) {
    // Always send credentials (cookies)
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    };
    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {})
      }
    };
    const response = await fetch(`${API_URL}${endpoint}`, requestOptions);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication error. Please login again.');
        // No need to clear localStorage, just redirect or handle as needed
        throw new Error('Authentication failed. Please login again.');
      }
      throw new Error(`API call failed: ${response.statusText}`);
    }
    return response.json();
  }

  async directFetch(endpoint: string, options: RequestInit = {}) {
    // Always send credentials (cookies)
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    };
    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {})
      }
    };
    return fetch(`${API_URL}${endpoint}`, requestOptions);
  }

  async fetchSpaces() {
    try {
      return await this.apiCall('/spaces');
    } catch (error) {
      message.error('Failed to load spaces');
      return [];
    }
  }

  async fetchApprovedCabinets(spaceId: string) {
    try {
      return await this.apiCall(`/cabinets/approved?spaceId=${spaceId}`);
    } catch (error) {
      message.error(`Failed to load cabinets for space ${spaceId}`);
      return [];
    }
  }

  async fetchCabinetDetails(cabinetId: string) {
    try {
      return await this.apiCall(`/cabinets/${cabinetId}`);
    } catch (error) {
      message.error(`Failed to load details for cabinet ${cabinetId}`);
      return null;
    }
  }

  async fetchUsers() {
    try {
      return await this.apiCall('/spaces/available-users');
    } catch (error) {
      message.error('Failed to load users');
      return [];
    }
  }

  async fetchAllSearchData() {
    try {
      // Spaces əldə edilir
      const spaces = await this.fetchSpaces();
      // Hər space üçün approved cabinetlər
      const cabinetPromises = spaces.map((space: any) =>
        this.fetchApprovedCabinets(space.id).catch(err => {
          console.error(`Error fetching cabinets for space ${space.id}:`, err);
          return [];
        })
      );
      const cabinetResults = await Promise.all(cabinetPromises);
      const allCabinets = cabinetResults.flat().filter((cabinet: any) =>
        cabinet && cabinet.status === 'approved'
      );
      // Cabinet detalları
      const cabinetDetailPromises = allCabinets.map((cabinet: any) =>
        this.fetchCabinetDetails(cabinet.id).catch(err => {
          console.error(`Error fetching details for cabinet ${cabinet.id}:`, err);
          return null;
        })
      );
      const cabinetDetails = await Promise.all(cabinetDetailPromises);
      // Field names (cabinet.customFields varsa)
      const allFieldNames = new Set<string>();
      cabinetDetails.forEach(cabinet => {
        if (cabinet && cabinet.customFields && Array.isArray(cabinet.customFields)) {
          cabinet.customFields.forEach((field: { name: string }) => {
            if (field && field.name) {
              allFieldNames.add(field.name);
            }
          });
        }
      });
      const fieldNames = Array.from(allFieldNames).sort();
      // Company names (həm spaces, həm də cabinets)
      const companySet = new Set<string>();
      spaces.forEach((space: any) => {
        if (space.company && typeof space.company === 'string' && space.company.trim() !== '') {
          companySet.add(space.company);
        }
      });
      allCabinets.forEach((cabinet: any) => {
        if (cabinet.company && typeof cabinet.company === 'string' && cabinet.company.trim() !== '') {
          companySet.add(cabinet.company);
        }
      });
      const companies = Array.from(companySet).sort();
      // Tags (həm spaces, həm də cabinets)
      const tagsSet = new Set<string>();
      spaces.forEach((space: any) => {
        if (space.tags && Array.isArray(space.tags)) {
          space.tags.forEach((tag: string) => {
            if (typeof tag === 'string' && tag.trim() !== '') {
              tagsSet.add(tag.trim());
            }
          });
        }
      });
      allCabinets.forEach((cabinet: any) => {
        if (cabinet.tags && Array.isArray(cabinet.tags)) {
          cabinet.tags.forEach((tag: string) => {
            if (typeof tag === 'string' && tag.trim() !== '') {
              tagsSet.add(tag.trim());
            }
          });
        }
      });
      const tags = Array.from(tagsSet).sort();
      // İstifadəçilər
      const users = await this.fetchUsers();
      return {
        spaces,
        cabinets: allCabinets,
        fieldNames,
        companies,
        tags,
        users
      };
    } catch (error) {
      console.error('Error fetching all search data:', error);
      message.error('Failed to load search data');
      return {
        spaces: [],
        cabinets: [],
        fieldNames: [],
        companies: [],
        tags: [],
        users: []
      };
    }
  }

  async testDirectSearch(searchText: string) {
    try {
      console.log(`Testing direct search with text: "${searchText}"`);
      const response = await this.directFetch(`/search/direct-text-search?text=${encodeURIComponent(searchText)}`);
      if (!response.ok) {
        throw new Error('Direct search test failed');
      }
      const data = await response.json();
      console.log('Direct search test results:', data);
      return data;
    } catch (error) {
      console.error('Error testing direct search:', error);
      message.error('Direct search test failed');
      return { records: [], count: 0 };
    }
  }
  // Remove checkAuthStatus and isAuthenticated
}

export const apiService = new ApiService();

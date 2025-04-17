// // SearchResultsPage.test.tsx
// import React from 'react';
// import SearchResultsPage from '../../app/dashboard/search-results/page';
// import apiService from '../../app/services/apiService';
// import { render, screen, waitFor, fireEvent } from '@testing-library/react';
// import '@testing-library/jest-dom';

// jest.mock('../services/apiService', () => ({
//   performAdvancedSearch: jest.fn().mockResolvedValue({
//     records: [],
//     cabinets: [],
//     spaces: [],
//     total: 0
//   })
// }));

// describe('SearchResultsPage', () => {
//   jest.mock('../services/apiService', () => ({
//     performAdvancedSearch: jest.fn().mockResolvedValue({
//       records: [],
//       cabinets: [],
//       spaces: [],
//       total: 0
//     })
//   }));

//   describe('SearchResultsPage', () => {
//     const mockResults = {
//       records: [{ id: '1', title: 'Test Record' }],
//       cabinets: [{ id: '1', name: 'Test Cabinet' }],
//       spaces: [{ id: '1', name: 'Test Space' }],
//       total: 3
//     };

//     beforeEach(() => {
//       jest.clearAllMocks();
//     });

//     test('shows loading state initially', () => {
//       render(<SearchResultsPage />);
//       expect(screen.getByRole('progressbar')).toBeInTheDocument();
//     });

//     test('displays search results correctly', async () => {
//       (apiService.performSearch as jest.Mock).mockResolvedValueOnce(mockResults);
      
//       render(<SearchResultsPage />);
      
//       await waitFor(() => {
//         expect(screen.getByText('Test Record')).toBeInTheDocument();
//         expect(screen.getByText('Test Cabinet')).toBeInTheDocument();
//         expect(screen.getByText('Found 3 results in total')).toBeInTheDocument();
//       });
//     });

//     test('handles empty results state', async () => {
//       render(<SearchResultsPage />);
      
//       await waitFor(() => {
//         expect(screen.getByText('No results found')).toBeInTheDocument();
//       });
//     });

//     test('displays error message on failure', async () => {
//       (apiService.performSearch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
      
//       render(<SearchResultsPage />);
      
//       await waitFor(() => {
//         expect(screen.getByRole('alert')).toHaveTextContent('Failed to load results');
//       });
//     });

//     test('displays spaces correctly', async () => {
//       (apiService.performSearch as jest.Mock).mockResolvedValueOnce(mockResults);
      
//       render(<SearchResultsPage />);
      
//       await waitFor(() => {
//         expect(screen.getByText('Test Space')).toBeInTheDocument();
//       });
//     });

//     test('handles pagination correctly', async () => {
//       (apiService.performSearch as jest.Mock).mockResolvedValueOnce({
//         ...mockResults,
//         total: 20
//       });
      
//       render(<SearchResultsPage />);
      
//       await waitFor(() => {
//         expect(screen.getByText('Test Record')).toBeInTheDocument();
//       });
      
//       const nextPageButton = screen.getByLabelText('Go to next page');
//       fireEvent.click(nextPageButton);
      
//       expect(apiService.performSearch).toHaveBeenCalledTimes(2);
//       expect(apiService.performSearch).toHaveBeenLastCalledWith(expect.objectContaining({
//         page: 2
//       }));
//     });

//     test('allows filtering by result type', async () => {
//       (apiService.performSearch as jest.Mock).mockResolvedValueOnce(mockResults);
      
//       render(<SearchResultsPage />);
      
//       await waitFor(() => {
//         expect(screen.getByText('Test Record')).toBeInTheDocument();
//       });
      
//       const filterSelect = screen.getByLabelText('Filter results');
//       fireEvent.change(filterSelect, { target: { value: 'records' } });
      
//       expect(apiService.performSearch).toHaveBeenCalledWith(expect.objectContaining({
//         type: 'records'
//       }));
//     });
//   });
//   });

//   test('handles empty results state', async () => {
//     render(<SearchResultsPage />);
    
//     await waitFor(() => {
//       expect(screen.getByText('No results found')).toBeInTheDocument();
//     });
//   });

//   test('displays error message on failure', async () => {
//     (apiService.performSearch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
    
//     render(<SearchResultsPage />);
    
//     await waitFor(() => {
//       expect(screen.getByRole('alert')).toHaveTextContent('Failed to load results');
//     });
//   });

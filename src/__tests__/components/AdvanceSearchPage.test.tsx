// // AdvanceSearchPage.test.tsx
// import React from 'react';
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import AdvanceSearchPage from '../../app/dashboard/AdvanceSearch/page';
// import apiService from '../../app/services/apiService';

// jest.mock('../services/apiService', () => ({
//   fetchAllSearchData: jest.fn().mockResolvedValue({
//     spaces: [],
//     cabinets: [],
//     fieldNames: [],
//     companies: [],
//     tags: [],
//     users: []
//   })
// }));

// describe('AdvanceSearchPage', () => {
//   beforeEach(() => {
//     jest.clearAllMocks();
//   });

//   test('renders search form with all components', async () => {
//     render(<AdvanceSearchPage />);
    
//     expect(await screen.findByText('Advanced Search')).toBeInTheDocument();
//     expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument();
//     expect(screen.getByLabelText('Strict match')).toBeInTheDocument();
//     expect(screen.getByLabelText('Search All')).toBeChecked();
//   });

//   test('loads and displays filter options', async () => {
//     (apiService.fetchAllSearchDatas as jest.Mock).mockResolvedValueOnce({
//       cabinets: [{ id: '1', name: 'Test Cabinet' }],
//       users: [{ id: '1', firstName: 'John', lastName: 'Doe' }]
//     });

//     render(<AdvanceSearchPage />);
    
//     await waitFor(() => {
//       expect(screen.getByText('Test Cabinet')).toBeInTheDocument();
//       expect(screen.getByText('John Doe')).toBeInTheDocument();
//     });
//   });

//   test('validates form submission', async () => {
//     render(<AdvanceSearchPage />);
    
//     fireEvent.click(screen.getByRole('button', { name: /search/i }));
    
//     await waitFor(() => {
//       expect(screen.getByText('Please enter at least one search criteria')).toBeInTheDocument();
//     });
//   });

//   test('updates form state correctly', async () => {
//     render(<AdvanceSearchPage />);
    
//     fireEvent.change(screen.getByRole('textbox', { name: /search/i }), {
//       target: { value: 'test query' }
//     });
//     fireEvent.click(screen.getByLabelText('Has File'));
    
//     expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('test query');
//     expect(screen.getByLabelText('Has File')).toBeChecked();
//   });
// });
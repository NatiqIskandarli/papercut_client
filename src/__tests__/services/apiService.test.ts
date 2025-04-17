// // apiService.test.ts
// import apiService from '../../app/services/apiService';
// import fetchMock from 'jest-fetch-mock';

// fetchMock.enableMocks();

// describe('apiService', () => {
//   beforeEach(() => {
//     fetchMock.resetMocks();
//     localStorage.setItem('access_token', 'test-token');
//   });

//   test('performs advanced search correctly', async () => {
//     const mockResponse = { records: [], total: 0 };
//     fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
    
//     const result = await apiService.performSearch({ 
//       query: 'test',
//       options: {
//         strictMatch: false,
//         tolerance: 2,
//         allowedTolerance: false,
//         searchInsideRecords: false,
//         hasFile: false,
//         searchField: true
//       }
//     });
    
//     expect(fetchMock).toHaveBeenCalledWith(
//       expect.stringContaining('/search/advanced'),
//       expect.objectContaining({
//         method: 'POST',
//         headers: {
//           'Authorization': 'Bearer test-token',
//           'Content-Type': 'application/json'
//         }
//       })
//     );
//     expect(result).toEqual(mockResponse);
//   });

//   test('handles network errors', async () => {
//     fetchMock.mockRejectOnce(new Error('Network error'));
    
//     const result = await apiService.performSearch({ 
//       query: 'test',
//       options: {
//         strictMatch: false,
//         tolerance: 2,
//         allowedTolerance: false,
//         searchInsideRecords: false,
//         hasFile: false,
//         searchField: true
//       }
//     });
    
//     expect(result).toEqual({
//       records: [],
//       cabinets: [],
//       spaces: [],
//       total: 0
//     });
//   });
// });
// Optional: configure or set up a testing framework before each test.
import '@testing-library/jest-dom';

// Mock the next/router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  }),
  useSearchParams: () => ({
    get: jest.fn().mockImplementation(param => {
      if (param === 'q') {
        return JSON.stringify({
          query: 'test search',
          options: { 
            strictMatch: false,
            tolerance: 2,
            allowedTolerance: true,
            hasFile: true
          }
        });
      }
      return null;
    })
  }),
}));

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    removeItem: function(key) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});
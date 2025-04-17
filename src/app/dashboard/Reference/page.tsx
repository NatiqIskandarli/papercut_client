'use client';
import React, { useState, useEffect } from 'react';
import { API_URL } from '@/app/config';

interface Reference {
  id: string;
  name: string;
  type: string;
}

const types = [
  'Document Type',
  'Company',
  'Vendor Name',
  'Customs Department',
  'Contract Number',
  'Sub-Contractor Name',
];

export default function ReferencePage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [formData, setFormData] = useState({ name: '', type: types[0] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/references`);
      const data = await res.json();
      
      console.log('API response:', data); // Log API response for debugging
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setReferences(data);
      } else if (data && typeof data === 'object') {
        // If data is an object with references property
        if (Array.isArray(data.references)) {
          setReferences(data.references);
        } else {
          // If it's some other object structure, convert to array if possible
          const possibleArray = Object.values(data).find(val => Array.isArray(val));
          if (possibleArray) {
            setReferences(possibleArray);
          } else {
            console.error('Unexpected data format:', data);
            setError('Unexpected data format from API');
            setReferences([]);
          }
        }
      } else {
        console.error('Unexpected data format:', data);
        setError('Unexpected data format from API');
        setReferences([]);
      }
    } catch (err) {
      console.error('Error fetching references:', err);
      setError('Failed to fetch references');
      setReferences([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update
        await fetch(`${API_URL}/references/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // Create
        await fetch(`${API_URL}/references`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setFormData({ name: '', type: types[0] });
      setEditingId(null);
      fetchReferences();
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Failed to save reference');
    }
  };

  const handleEdit = (ref: Reference) => {
    setFormData({ name: ref.name, type: ref.type });
    setEditingId(ref.id);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_URL}/references/${id}`, { method: 'DELETE' });
      fetchReferences();
    } catch (err) {
      console.error('Error deleting reference:', err);
      setError('Failed to delete reference');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Reference Management</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-2">
          <label className="block">Name:</label>
          <input
            type="text"
            className="border p-1 w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="mb-2">
          <label className="block">Type:</label>
          <select
            className="border p-1 w-full"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">
          {editingId ? 'Update' : 'Add'}
        </button>
      </form>
      
      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : references.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No references found</div>
      ) : (
        <div>
          {references.map((ref) => (
            <div key={ref.id} className="border p-2 mb-2 flex justify-between">
              <div>
                <div className="font-semibold">{ref.name}</div>
                <div className="text-sm text-gray-600">{ref.type}</div>
              </div>
              <div>
                <button onClick={() => handleEdit(ref)} className="bg-yellow-500 text-white px-2 py-1 rounded mr-2">
                  Edit
                </button>
                <button onClick={() => handleDelete(ref.id)} className="bg-red-500 text-white px-2 py-1 rounded">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

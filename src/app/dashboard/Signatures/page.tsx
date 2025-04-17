'use client';
import React, { useRef, useState, useEffect } from 'react';
import { message, Spin, Button, Upload } from 'antd'; // Import Button and Upload
import { UploadOutlined } from '@ant-design/icons'; // Import icon for Upload button
import type { RcFile, UploadProps } from 'antd/es/upload/interface'; // Import types for Upload component
import { uploadImage } from '@/utils/api'; // Import the upload function

// Helper function to convert Base64 Data URL to File object (Keep this as it is)
function dataURLtoFile(dataurl: string, filename: string): File | null {
    // ... (your existing dataURLtoFile function)
    try {
        const arr = dataurl.split(',');
        if (!arr[0]) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type:mime});
    } catch (e) {
        console.error("Error converting data URL to File:", e);
        return null;
    }
}


// Updated interface to store R2 URL (Keep this as it is)
interface Signature {
  id: string;
  url: string; // Store R2 URL instead of dataUrl
  createdAt: string;
}

export default function SignaturesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [isSavingCanvas, setIsSavingCanvas] = useState(false); // Renamed for clarity
  const [isUploadingFile, setIsUploadingFile] = useState(false); // New state for file upload loading
  const [selectedFile, setSelectedFile] = useState<RcFile | null>(null); // State to hold the selected file

  // Load signatures from localStorage (Keep this as it is)
  useEffect(() => {
    try {
        const savedSignatures = localStorage.getItem('signatures_r2'); // Use a new key
        if (savedSignatures) {
            setSignatures(JSON.parse(savedSignatures));
        }
    } catch (error) {
        console.error("Error loading signatures from localStorage:", error);
        localStorage.removeItem('signatures_r2'); // Clear corrupted data
    }
  }, []);

  // Prepare canvas (Keep this as it is)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = 'black';
      }
    }
  }, []);

  // --- Drawing functions (Keep these as they are) ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); const canvas = canvasRef.current; if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) { const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; ctx.beginPath(); ctx.moveTo(x, y); } } };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => { if (!isDrawing) return; const canvas = canvasRef.current; if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) { const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; ctx.lineTo(x, y); ctx.stroke(); } } };
  const stopDrawing = () => { setIsDrawing(false); const canvas = canvasRef.current; if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) { ctx.closePath(); } } };
  const clearCanvas = () => { const canvas = canvasRef.current; if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); } } };

  // --- Save Drawn Signature ---
  const saveDrawnSignature = async () => { // Renamed for clarity
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if canvas is empty (Keep this check)
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let isCanvasEmpty = true;
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] !== 0) {
                isCanvasEmpty = false;
                break;
            }
        }
        if (isCanvasEmpty) {
            message.warning('Please draw a signature before saving.');
            return;
        }
    }

    setIsSavingCanvas(true); // Use renamed state
    message.loading({ content: 'Saving drawn signature...', key: 'savingCanvasSig' });

    try {
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `signature-drawn-${Date.now()}.png`;
        const signatureFile = dataURLtoFile(dataUrl, filename);

        if (!signatureFile) {
            throw new Error('Could not convert canvas to file.');
        }

        // Upload the file to R2 via the backend API
        const uploadResult = await uploadImage(signatureFile, 'signature');

        // Create the new signature object with the R2 URL
        const newSignature: Signature = {
            id: `drawn-${Date.now().toString()}`, // Added prefix for potential differentiation
            url: uploadResult.url,
            createdAt: new Date().toISOString(),
        };

        // Update state and localStorage
        const updatedSignatures = [...signatures, newSignature];
        setSignatures(updatedSignatures);
        localStorage.setItem('signatures_r2', JSON.stringify(updatedSignatures));

        message.success({ content: 'Drawn signature saved successfully!', key: 'savingCanvasSig', duration: 2 });
        clearCanvas();

    } catch (error: any) {
        console.error('Error saving drawn signature:', error);
        message.error({ content: `Error saving drawn signature: ${error.message}`, key: 'savingCanvasSig', duration: 4 });
    } finally {
        setIsSavingCanvas(false); // Use renamed state
    }
  };

  // --- NEW: Handle File Upload ---
  const handleFileUpload = async () => {
    if (!selectedFile) {
        message.warning('Please select a signature file to upload.');
        return;
    }

    setIsUploadingFile(true);
    message.loading({ content: 'Uploading signature file...', key: 'uploadingFileSig' });

    try {
        // Upload the selected file
        const uploadResult = await uploadImage(selectedFile, 'signature');

        // Create the new signature object
        const newSignature: Signature = {
            id: `uploaded-${Date.now().toString()}`, // Added prefix
            url: uploadResult.url,
            createdAt: new Date().toISOString(),
        };

        // Update state and localStorage
        const updatedSignatures = [...signatures, newSignature];
        setSignatures(updatedSignatures);
        localStorage.setItem('signatures_r2', JSON.stringify(updatedSignatures));

        message.success({ content: 'Signature file uploaded successfully!', key: 'uploadingFileSig', duration: 2 });
        setSelectedFile(null); // Clear the selected file state

    } catch (error: any) {
        console.error('Error uploading signature file:', error);
        message.error({ content: `Error uploading signature file: ${error.message}`, key: 'uploadingFileSig', duration: 4 });
    } finally {
        setIsUploadingFile(false);
    }
  };

  // --- Ant Design Upload component props ---
  const uploadProps: UploadProps = {
    name: 'signatureFile', // Input name
    accept: 'image/png, image/jpeg, image/jpg, image/gif', // Accept only common image types
    multiple: false, // Only allow single file selection
    beforeUpload: (file) => {
      // Store the file in state *before* upload triggers (which we handle manually)
      // Return false to prevent antd's default upload behavior
      setSelectedFile(file);
      return false;
    },
    onRemove: () => {
      // Clear the state if the user removes the file from the Upload component
      setSelectedFile(null);
    },
    fileList: selectedFile ? [selectedFile] : [], // Control the displayed file list
  };


  // --- Delete Signature (Keep this as it is) ---
  const deleteSignature = (id: string) => {
    // Optional: Add logic here to call a backend endpoint to delete the file from R2
    // using the stored key, before removing it from localStorage.

    const updatedSignatures = signatures.filter(sig => sig.id !== id);
    setSignatures(updatedSignatures);
    localStorage.setItem('signatures_r2', JSON.stringify(updatedSignatures));
    message.success('Signature deleted.');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create and Manage Signatures</h1>

      {/* --- Section 1: Draw Signature --- */}
      <div className="mb-8 p-4 border rounded-md shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Option 1: Draw Your Signature</h2>
        <canvas
          ref={canvasRef} width={400} height={200}
          className="border border-gray-300 rounded-md bg-white cursor-crosshair" // Added cursor
          onMouseDown={startDrawing} onMouseMove={draw}
          onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
        />
        <div className="mt-4 flex gap-2">
          <Button onClick={clearCanvas} disabled={isSavingCanvas}>Clear</Button>
          <Button
             type="primary" // Antd button styling
             onClick={saveDrawnSignature}
             loading={isSavingCanvas} // Use loading prop
             disabled={isUploadingFile} // Disable if file upload is in progress
           >
            Save Drawn Signature
          </Button>
        </div>
      </div>

      {/* --- Section 2: Upload Signature File --- */}
      <div className="mb-8 p-4 border rounded-md shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Option 2: Upload Signature File</h2>
          <div className="flex items-center gap-4">
              {/* Ant Design Upload Component */}
              <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />} disabled={isSavingCanvas || isUploadingFile}>
                      Select File
                  </Button>
              </Upload>
              {/* Upload Button */}
              <Button
                  type="primary"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isSavingCanvas} // Disable if no file or canvas saving
                  loading={isUploadingFile}
              >
                  Upload Selected Signature
              </Button>
          </div>
          {/* Display selected file name (optional but good UX) */}
          {selectedFile && <p className="text-sm text-gray-600 mt-2">Selected: {selectedFile.name}</p>}
      </div>


      {/* --- Section 3: Saved Signatures --- */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Saved Signatures</h2>
        {signatures.length === 0 ? (
          <p className="text-gray-500">No signatures saved yet. Draw or upload one!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {signatures.map(sig => (
              <div key={sig.id} className="border p-2 rounded-md flex flex-col items-center justify-between bg-white shadow hover:shadow-md transition-shadow">
                <img
                  src={sig.url}
                  alt="Saved Signature"
                  className="h-20 w-full object-contain mb-2 bg-gray-50 p-1 rounded" // Adjusted styling slightly
                 />
                 <div className='text-center w-full'>
                     <p className="text-xs text-gray-500 mb-2 break-words" title={new Date(sig.createdAt).toLocaleString()}>
                        {new Date(sig.createdAt).toLocaleDateString()} {/* Show only date for brevity */}
                     </p>
                     <Button
                        danger // Antd style for delete button
                        size="small" // Make button smaller
                        onClick={() => deleteSignature(sig.id)}
                        disabled={isSavingCanvas || isUploadingFile} // Disable while actions are in progress
                     >
                        Delete
                    </Button>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
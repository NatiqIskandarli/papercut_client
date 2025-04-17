'use client';
import React, { useState, useEffect, useRef } from 'react';
import { message, Spin } from 'antd'; // Import Spin
import { uploadImage } from '@/utils/api'; // Import the upload function

// Helper function (can be shared in a utils file)
function dataURLtoFile(dataurl: string, filename: string): File | null { /* ... same as above ... */ try { const arr = dataurl.split(','); if (!arr[0]) return null; const mimeMatch = arr[0].match(/:(.*?);/); if (!mimeMatch || mimeMatch.length < 2) return null; const mime = mimeMatch[1]; const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n); while(n--){ u8arr[n] = bstr.charCodeAt(n); } return new File([u8arr], filename, {type:mime}); } catch (e) { console.error("Error converting data URL to File:", e); return null; } }

// Updated interface
interface Stamp {
  id: string;
  url: string; // Store R2 URL
  createdAt: string;
}

export default function StampsPage() {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null); // Store original uploaded DataURL
  const [scale, setScale] = useState<number>(1);
  const [backgroundRemoved, setBackgroundRemoved] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // Loading state for processing/saving
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load stamps from localStorage
  useEffect(() => {
     try {
        const savedStamps = localStorage.getItem('stamps_r2'); // Use new key
        if (savedStamps) {
            setStamps(JSON.parse(savedStamps));
        }
     } catch (error) {
        console.error("Error loading stamps from localStorage:", error);
        localStorage.removeItem('stamps_r2');
     }
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       // Add file size and type validation if needed here
       const reader = new FileReader();
       reader.onloadend = () => {
         const dataUrl = reader.result as string;
         setOriginalImage(dataUrl); // Store the original
         setScale(1);
         setBackgroundRemoved(false);
         drawImageOnCanvas(dataUrl, 1, false); // Draw initial image
       };
       reader.readAsDataURL(file);
    }
  };

  // Draw image on canvas (includes background removal logic)
  const drawImageOnCanvas = (dataUrl: string, scaleFactor: number, removeBg: boolean) => {
    // Wrap in promise to handle async image loading
    return new Promise<void>((resolve, reject) => {
        const canvas = canvasRef.current;
        if (!canvas || !dataUrl) return reject(new Error("Canvas or image data missing"));

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Could not get canvas context"));

        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            // Adjust canvas size based on image and scale
            const targetWidth = img.width * scaleFactor;
            const targetHeight = img.height * scaleFactor;
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // Clear and draw the scaled image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // Background removal (simple white removal)
            if (removeBg) {
                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const tolerance = 50; // Tolerance for near-white colors

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        // Check if the pixel is close to white
                        if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) {
                            data[i + 3] = 0; // Make it transparent
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                } catch (e) {
                     console.error("Error processing image data for background removal:", e);
                     // Don't reject, just log the error, background removal might fail on tainted canvas
                }
            }
            resolve(); // Resolve promise when drawing is complete
        };
        img.onerror = () => {
             reject(new Error("Failed to load image onto canvas"));
        };
    });
  };

  // Redraw canvas when scale or background removal changes
  useEffect(() => {
    if (originalImage) {
        setIsProcessing(true); // Show loading while redrawing
        drawImageOnCanvas(originalImage, scale, backgroundRemoved)
            .catch(error => message.error(`Error redrawing canvas: ${error.message}`))
            .finally(() => setIsProcessing(false));
    }
  }, [originalImage, scale, backgroundRemoved]); // Dependencies

  // Toggle background removal
  const handleRemoveBackground = () => {
    setBackgroundRemoved(prev => !prev); // Toggle state
  };

  // --- MODIFIED Save Stamp ---
  const saveStamp = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) {
        message.warning("Please upload an image first.");
        return;
    };

    setIsProcessing(true); // Use isProcessing for save button as well
    message.loading({ content: 'Saving stamp...', key: 'savingStamp' });

    try {
        // Ensure canvas is up-to-date before getting data URL
        await drawImageOnCanvas(originalImage, scale, backgroundRemoved);

        const dataUrl = canvas.toDataURL('image/png');
        const filename = `stamp-${Date.now()}.png`;
        const stampFile = dataURLtoFile(dataUrl, filename);

        if (!stampFile) {
            throw new Error('Could not convert canvas to file.');
        }

        // Upload the processed image file
        const uploadResult = await uploadImage(stampFile, 'stamp');

        // Create new stamp object with R2 URL
        const newStamp: Stamp = {
            id: Date.now().toString(),
            url: uploadResult.url, // Store the public URL
            // key: uploadResult.key, // Optionally store key
            createdAt: new Date().toISOString(),
        };

        // Update state and localStorage
        const updatedStamps = [...stamps, newStamp];
        setStamps(updatedStamps);
        localStorage.setItem('stamps_r2', JSON.stringify(updatedStamps)); // Use new key

        message.success({ content: 'Stamp saved successfully!', key: 'savingStamp', duration: 2 });

        // Reset the form
        setOriginalImage(null);
        setScale(1);
        setBackgroundRemoved(false);
        if(canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            canvasRef.current.width = 300; // Reset canvas size
            canvasRef.current.height = 150;
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

    } catch (error: any) {
        console.error('Error saving stamp:', error);
        message.error({ content: `Error saving stamp: ${error.message}`, key: 'savingStamp', duration: 4 });
    } finally {
        setIsProcessing(false);
    }
  };

  // --- MODIFIED Delete Stamp ---
  const deleteStamp = (id: string) => {
    // Optional: Add R2 deletion logic here
    const updatedStamps = stamps.filter(stamp => stamp.id !== id);
    setStamps(updatedStamps);
    localStorage.setItem('stamps_r2', JSON.stringify(updatedStamps)); // Use new key
    message.success('Stamp deleted.');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create and Manage Stamps</h1>

      {/* Möhür yükləmək və redaktə etmək */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Upload and Edit Stamp</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mb-4">
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <p className="mt-2 text-xs text-gray-500">(PNG, JPG up to 1MB)</p>
        </div>

        {/* Şəkil redaktə paneli */}
        {originalImage && (
          <div className="bg-white p-4 rounded shadow relative">
            {isProcessing && (
                 <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <Spin tip="Processing..." />
                 </div>
            )}
            <div className={`flex flex-col items-center ${isProcessing ? 'opacity-50' : ''}`}>
              {/* Set initial canvas size, it will be adjusted by drawImageOnCanvas */}
              <canvas ref={canvasRef} width={300} height={150} className="border border-gray-300 rounded-md mb-4 max-w-full h-auto" />
              <div className="w-full max-w-md">
                {/* Ölçü dəyişikliyi üçün slider */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resize Stamp ({Math.round(scale*100)}%)</label>
                  <input type="range" min="0.2" max="3" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" disabled={isProcessing}/>
                  <div className="flex justify-between text-xs text-gray-500 mt-1"><span>20%</span><span>100%</span><span>300%</span></div>
                </div>
                {/* Fon silmə düyməsi */}
                <div className="mb-4">
                  <button onClick={handleRemoveBackground} className={`border px-4 py-2 rounded w-full transition-colors ${backgroundRemoved ? 'bg-red-100 border-red-300 text-red-700' : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'}`} disabled={isProcessing}>
                    {backgroundRemoved ? 'Undo Background Removal' : 'Remove White Background'}
                  </button>
                </div>
                {/* Yadda saxlama düyməsi */}
                <button onClick={saveStamp} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full flex items-center justify-center gap-2" disabled={isProcessing}>
                   {isProcessing && <Spin size="small" />}
                   Save Stamp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Yadda saxlanmış möhürlər */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Saved Stamps</h2>
        {stamps.length === 0 ? (
          <p className="text-gray-500">No stamps saved yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stamps.map(stamp => (
              <div key={stamp.id} className="border p-2 rounded-md flex flex-col items-center bg-white shadow">
                {/* Use R2 URL */}
                <img src={stamp.url} alt="Saved Stamp" className="h-20 w-auto object-contain mb-2 bg-gray-100 p-1 rounded" />
                <p className="text-xs text-gray-500 mb-2 text-center break-all">
                  {new Date(stamp.createdAt).toLocaleString()}
                </p>
                <button onClick={() => deleteStamp(stamp.id)} className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// /client/src/components/LetterPreviewPanelReview.tsx

'use client';

import React, { useRef, useEffect, useState } from 'react';
import CkeditorOzel from '../app/dashboard/CreateLetter/ckeditor_letter';

import { Typography, Image as AntImage } from 'antd';

const { Text } = Typography;

interface SavedTemplate {
  id: string;
  name?: string;
  content: string;
}

interface FormData {
  [key: string]: string;
}

interface DynamicDbData {
  companies: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  contracts: Array<{ id: string; name: string }>;
  customs: Array<{ id: string; name: string }>;
  documentTypes: Array<{ id: string; name: string }>;
  subContractorNames: Array<{ id: string; name: string }>;
}

interface PlacedItemHtml {
  id: string;
  type: 'signature' | 'stamp' | 'qrcode';
  url?: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

interface LetterPreviewPanelReviewProps {
  template: SavedTemplate | null;
  formData: FormData;
  dbData: DynamicDbData;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  onLetterClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  placedItems: PlacedItemHtml[];
  onRemoveItem?: (id: string) => void;
}

export default function LetterPreviewPanelReview({
  template,
  formData,
  dbData,
  signatureUrl,
  stampUrl,
  onLetterClick,
  placedItems,
  onRemoveItem
}: LetterPreviewPanelReviewProps) {
  const [processedContent, setProcessedContent] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (template?.content) {
      const renderedContent = renderContentWithPlaceholders(template.content);
      setProcessedContent(renderedContent);
    }
  }, [template, formData]);

  const renderContentWithPlaceholders = (text: string): string => {
    if (!text) return '';
    return text.replace(/#([a-zA-Z0-9-_]+)#/g, (match, p1) => {
      return formData[p1] || `[${p1} boşdur]`;
    });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onLetterClick) onLetterClick(event);
  };

  if (!template) {
    return <div className="text-gray-500 text-center">Template data is missing. Cannot render preview.</div>;
  }

  return (
    <div className="space-y-4 relative bg-white rounded-lg shadow border border-gray-200 min-h-[800px] text-sm font-serif leading-relaxed">
      <div ref={wrapperRef} className="ck-editor-wrapper" onClick={handleClick}>
        <CkeditorOzel initialData={processedContent} onChange={() => {}} readOnly={true} customFields={[]} />

        {placedItems.map(item => {
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${item.xPct * 100}%`,
            top: `${item.yPct * 100}%`,
            width: `${item.widthPct * 100}%`,
            height: `${item.heightPct * 100}%`,
            cursor: 'pointer',
          };

          if (item.type === 'qrcode') {
            return (
              <div
                key={item.id}
                style={style}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveItem?.(item.id);
                }}
              >
                <div className="flex items-center justify-center w-full h-full text-white bg-green-700 border-2 border-white border-dashed font-bold">
                  QR
                </div>
              </div>
            );
          } else {
            return (
              <img
                key={item.id}
                src={item.url}
                alt={item.type}
                style={style}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveItem?.(item.id);
                }}
              />
            );
          }
        })}
      </div>

      {!placedItems.length && (
        <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end h-24">
          {signatureUrl && (
            <div className="flex flex-col items-center">
              <AntImage src={signatureUrl} alt="Signature" width={100} height={40} preview={false} className="object-contain" />
              <Text className="text-xs mt-1">Signature</Text>
            </div>
          )}
          {stampUrl && (
            <div className="flex flex-col items-center">
              <AntImage src={stampUrl} alt="Stamp" width={60} height={60} preview={false} className="object-contain" />
              <Text className="text-xs mt-1">Stamp</Text>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .ck-editor-wrapper {
          padding: 2rem 3rem;
          max-height: 800px;
          overflow-y: auto;
          position: relative;
        }
        .ck-editor-wrapper :global(.ck-content) {
          min-height: 600px;
          background-color: #fff;
          border: none;
          padding: 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 14px;
          line-height: 1.6;
          color: #333;
        }
      `}</style>
    </div>
  );
}

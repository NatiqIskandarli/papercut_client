import { useState, useEffect, useRef, useMemo } from 'react';
import { CKEditor, useCKEditorCloud } from '@ckeditor/ckeditor5-react';
import { API_URL } from '@/app/config';
import { usePathname } from 'next/navigation';

const LICENSE_KEY =
  'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NDgyMTc1OTksImp0aSI6ImU3NjNiMjc0LTA1YWEtNDIwMS1iMmQxLTM0NTBhODlkZGI4OSIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6IjM1ZTQwYmNlIn0.3rgZ1kQP8XaHbF6sM4iZ2Pss4hjtnrAX3zieWNpwczqBDGDA15Y8nPLO5fu4_Ap-1RzXh24Iw3LdFK7JrzodlQ';

interface CkeditorOzelProps {
  onChange: (data: string) => void;
  initialData: string;
  customFields?: Array<{ id: string; name: string; placeholder: string }>;
  readOnly?: boolean;
}

export default function CkeditorOzel({ onChange, initialData, customFields = [], readOnly = false }: CkeditorOzelProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorMenuBarRef = useRef<HTMLDivElement | null>(null);
  const editorToolbarRef = useRef<HTMLDivElement | null>(null);
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const cloud = useCKEditorCloud({ version: '45.0.0' });
  const pathname = usePathname();
  const isCreateLetterPage = pathname && pathname.includes('CreateLetter') || pathname.includes('LetterReview');

  // Mutable reference for customFields
  const customFieldsRef = useRef(customFields);

  // Update the reference when customFields changes
  useEffect(() => {
    customFieldsRef.current = customFields;
  }, [customFields]);

  useEffect(() => {
    setIsLayoutReady(true);
    return () => setIsLayoutReady(false);
  }, []);

  const { DecoupledEditor, editorConfig } = useMemo(() => {
    if (cloud.status !== 'success' || !isLayoutReady) {
      return {};
    }

    const {
      DecoupledEditor,
      Alignment,
      AutoImage,
      AutoLink,
      Autosave,
      BalloonToolbar,
      Bold,
      CloudServices,
      Code,
      Essentials,
      FontBackgroundColor,
      FontColor,
      FontFamily,
      FontSize,
      Heading,
      HorizontalLine,
      ImageBlock,
      ImageCaption,
      ImageEditing,
      ImageInline,
      ImageInsert,
      ImageInsertViaUrl,
      ImageResize,
      ImageStyle,
      ImageTextAlternative,
      ImageToolbar,
      ImageUpload,
      ImageUtils,
      Indent,
      IndentBlock,
      Italic,
      Link,
      LinkImage,
      List,
      ListProperties,
      Mention,
      Paragraph,
      RemoveFormat,
      SimpleUploadAdapter,
      Strikethrough,
      Subscript,
      Superscript,
      Table,
      TableCaption,
      TableCellProperties,
      TableColumnResize,
      TableProperties,
      TableToolbar,
      TodoList,
      Underline,
    } = cloud.CKEditor;

    return {
      DecoupledEditor,
      editorConfig: {
        toolbar: {
          items: [
            'heading',
            '|',
            'fontSize',
            'fontFamily',
            'fontColor',
            'fontBackgroundColor',
            '|',
            'bold',
            'italic',
            'underline',
            '|',
            'link',
            'insertImage',
            'insertTable',
            '|',
            'alignment',
            '|',
            'bulletedList',
            'numberedList',
            'todoList',
            'outdent',
            'indent',
          ],
          shouldNotGroupWhenFull: false,
        },
        plugins: [
          Alignment,
          AutoImage,
          AutoLink,
          Autosave,
          BalloonToolbar,
          Bold,
          CloudServices,
          Code,
          Essentials,
          FontBackgroundColor,
          FontColor,
          FontFamily,
          FontSize,
          Heading,
          HorizontalLine,
          ImageBlock,
          ImageCaption,
          ImageEditing,
          ImageInline,
          ImageInsert,
          ImageInsertViaUrl,
          ImageResize,
          ImageStyle,
          ImageTextAlternative,
          ImageToolbar,
          ImageUpload,
          ImageUtils,
          Indent,
          IndentBlock,
          Italic,
          Link,
          LinkImage,
          List,
          ListProperties,
          Mention,
          Paragraph,
          RemoveFormat,
          SimpleUploadAdapter,
          Strikethrough,
          Subscript,
          Superscript,
          Table,
          TableCaption,
          TableCellProperties,
          TableColumnResize,
          TableProperties,
          TableToolbar,
          TodoList,
          Underline,
        ],
        balloonToolbar: ['bold', 'italic', '|', 'link', 'insertImage', '|', 'bulletedList', 'numberedList'],
        fontFamily: {
          supportAllValues: true,
        },
        fontSize: {
          options: [10, 12, 14, 'default', 18, 20, 22],
          supportAllValues: true,
        },
        heading: {
          options: [
            { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
            { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
            { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
            { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
            { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
            { model: 'heading5', view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
            { model: 'heading6', view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' },
          ] as any,
        },
        image: {
          toolbar: [
            'toggleImageCaption',
            'imageTextAlternative',
            '|',
            'imageStyle:inline',
            'imageStyle:wrapText',
            'imageStyle:breakText',
            '|',
            'resizeImage',
          ],
        },
        simpleUpload: {
            uploadUrl: `${API_URL}/images/uploads`,
            withCredentials: true
        },
        initialData: initialData || '<p>Type your content here...</p>',
        readOnly: readOnly,
        licenseKey: LICENSE_KEY,
        link: {
          addTargetToExternalLinks: true,
          defaultProtocol: 'https://',
          decorators: {
            toggleDownloadable: {
              mode: 'manual' as const,
              label: 'Downloadable',
              attributes: {
                download: 'file',
              },
            },
          },
        },
        list: {
          properties: {
            styles: true,
            startIndex: true,
            reversed: true,
          },
        },
        placeholder: 'Type or paste your content here!',
        table: {
          contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties'],
        },
        
        mention: {
          feeds: [
            {
              marker: '#',
              feed: (query: string) => {
                const currentCustomFields = customFieldsRef.current;
                if (currentCustomFields.length === 0) {
                  return [{ id: 'no-fields', text: 'No fields available', isDisabled: true }];
                }
                const filteredFields = currentCustomFields
                  .filter((field) => field.name.toLowerCase().includes(query.toLowerCase()))
                  .map((field) => ({
                    id: field.placeholder,
                    text: field.placeholder,
                  }));
                return [
                  { id: 'category', text: 'Placeholders', isCategory: true },
                  ...filteredFields,
                ];
              },
              minimumCharacters: 0,
              itemRenderer: (item: any) => {
                const itemElement = document.createElement('span');
                if (item.isCategory) {
                  itemElement.classList.add('category-header');
                  itemElement.textContent = item.text;
                  itemElement.style.fontWeight = 'bold';
                } else {
                  itemElement.classList.add('custom-mention-item');
                  itemElement.textContent = item.text || '';
                }
                return itemElement;
              },
            },
          ],
        },
      },
    };
  }, [cloud, isLayoutReady, initialData]);

  return (
    <div className="main-container">
      <div className="editor-container editor-container_document-editor" ref={editorContainerRef}>
        <div className="editor-container__menu-bar" ref={editorMenuBarRef}></div>
        <div className="editor-container__toolbar" ref={editorToolbarRef}></div>
        <div className="editor-container__editor-wrapper">
          <div className="editor-container__editor_ozel" ref={editorRef}>
            {DecoupledEditor && editorConfig && (
              <CKEditor
                onReady={(editor) => {
                  if (editorToolbarRef.current && editor.ui.view.toolbar?.element) {
                    editorToolbarRef.current.appendChild(editor.ui.view.toolbar.element);
                  }
                  if (editorMenuBarRef.current && editor.ui.view.menuBarView?.element) {
                    editorMenuBarRef.current.appendChild(editor.ui.view.menuBarView.element);
                  }
                }}
                onAfterDestroy={() => {
                  if (editorToolbarRef.current) {
                    Array.from(editorToolbarRef.current.children).forEach((child) => child.remove());
                  }
                  if (editorMenuBarRef.current) {
                    Array.from(editorMenuBarRef.current.children).forEach((child) => child.remove());
                  }
                }}
                onChange={(event, editor) => {
                  const data = editor.getData();
                  onChange(data);
                }}
                editor={DecoupledEditor}
                config={editorConfig}
                disabled={readOnly}
                data={initialData}
              />
            )}
          </div>
        </div>
      </div>
  
      <style jsx>{`
      


        .main-container {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }
  
        .editor-container_document-editor {
          border: none;
          background: transparent;
        }

        .editor-container__editor_ozel {
          overflow: scroll !important;
          width: ${isCreateLetterPage ? 'auto' : '750px'};
          padding: ${isCreateLetterPage ? '15px' : '20px'};
          height: ${isCreateLetterPage ? '1192px' : '1192px'};
          background: white;
          margin: 15px;
          box-shadow: 0 7px 7px hsla(0, 0%, 0%, 0.078);
        }

        .container__editor_ozel {
          box-sizing: border-box;
          min-width: calc(210mm + 2px);
          max-width: calc(210mm + 2px);
          min-height: 297mm;
          height: -moz-fit-content;
          height: fit-content;
          padding: 0 !important;
          background: hsl(0, 0%, 100%);
          box-shadow: 0 2px 3px hsla(0, 0%, 0%, 0.078);
          flex: 1 1 auto;
          margin-left: 0 !important;
          margin-right: 0 !important;
          overflow: scroll !important;
        }
  
        .editor-container__menu-bar,
        .editor-container__toolbar {
          display: ${readOnly ? 'none' : 'block'};
        }
  
        .editor-container__editor-wrapper {
          width: 100%;
          overflow: ${isCreateLetterPage ? 'scroll' : 'hidden'};
          display: flex;
          flex-direction: column;
          align-items: center;
          max-height: ${isCreateLetterPage ? '1000px' : '1000px'};
        }
  
        .editor-container__editor {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
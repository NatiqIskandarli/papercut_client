'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Spin, List, Typography, Tag, Progress, Select, Modal, message, Tabs, Checkbox, Space, Table } from 'antd';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import '@uppy/progress-bar/dist/style.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const UploadFiles = ({ onRecordCreated, onFilesUploaded }) => {
  const [extractedFields, setExtractedFields] = useState(null);
  const [cabinetFields, setCabinetFields] = useState([]);
  const [selectedCabinetId, setSelectedCabinetId] = useState(null);
  const [cabinets, setCabinets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fieldMappings, setFieldMappings] = useState({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [processingFile, setProcessingFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [unallocatedFiles, setUnallocatedFiles] = useState([]);
  const [selectFilesModalVisible, setSelectFilesModalVisible] = useState(false);
  
  // New state for space/cabinet selection
  const [spaceSelectionModalVisible, setSpaceSelectionModalVisible] = useState(false);
  const [spaces, setSpaces] = useState([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  
  // Use a ref to hold the uppy instance
  const uppyInstance = useRef(null);
  
  // Initialize uppy inside useEffect to avoid localStorage issues during server rendering
  useEffect(() => {
    // Initialize Uppy only on the client side
    uppyInstance.current = new Uppy({
      restrictions: { 
        maxFileSize: 10000000, 
        maxNumberOfFiles: 100, // Increased to allow up to 100 files
        allowedFileTypes: ['application/pdf']
      },
      autoProceed: false,
      meta: {
        // Add metadata to indicate these files should go to Cloudflare R2
        storage: 'cloudflare_r2'
      }
    }).use(XHRUpload, { 
      endpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/upload`,
      formData: true,
      fieldName: 'files',
      bundle: true,
      // Remove token usage for authentication
      // Use fetch/axios with credentials: 'include' for all requests
      allowedMetaFields: ['originalName'] // Updated from metaFields to allowedMetaFields
    });

    // Set up event handlers for Uppy
    uppyInstance.current.on('upload-success', (file, response) => {
      const { body } = response;
      
      // Store uploaded files info
      if (Array.isArray(body.files)) {
        setUploadedFiles(body.files);
        setActionModalVisible(true);
      } else if (body.file) {
        setUploadedFiles([body.file]);
        setActionModalVisible(true);
      }
    });

    // Add file-added listener to preserve original filenames
    uppyInstance.current.on('file-added', (file) => {
      uppyInstance.current.setFileMeta(file.id, {
        originalName: file.name
      });
    });

    uppyInstance.current.on('upload-error', (file, error, response) => {
      console.error('Upload error:', error);
      message.error('File upload failed. Please try again.');
    });

    uppyInstance.current.on('complete', (result) => {
      if (result.successful.length > 0) {
        message.success(`Successfully uploaded ${result.successful.length} file(s)`);
      }
    });

    // Clean up function
    return () => {
      if (uppyInstance.current) {
        try {
          // Remove all event listeners
          uppyInstance.current.off('upload-success');
          uppyInstance.current.off('upload-error');
          uppyInstance.current.off('complete');
          uppyInstance.current.off('file-added');
          
          // Close and clean up uppy properly
          uppyInstance.current.cancelAll();
          uppyInstance.current.destroy();
        } catch (error) {
          console.error('Error cleaning up Uppy instance:', error);
        }
      }
    };
  }, []);

  // Fetch spaces when space selection modal is opened
  useEffect(() => {
    if (spaceSelectionModalVisible) {
      fetchSpaces();
    }
  }, [spaceSelectionModalVisible]);

  // Fetch cabinets when a space is selected
  useEffect(() => {
    if (selectedSpaceId) {
      fetchCabinetsBySpace(selectedSpaceId);
    }
  }, [selectedSpaceId]);

  // Fetch available cabinets on component mount
  useEffect(() => {
    //fetchCabinets();
    fetchUnallocatedFiles();
  }, []);

  // Fetch spaces
  const fetchSpaces = async () => {
    try {
      setLoadingSpaces(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/spaces`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSpaces(data);
      } else {
        console.error('Failed to fetch spaces');
        message.error('Failed to load spaces');
      }
    } catch (error) {
      console.error('Error fetching spaces:', error);
      message.error('Failed to load spaces');
    } finally {
      setLoadingSpaces(false);
    }
  };

  // Fetch cabinets by space ID
  const fetchCabinetsBySpace = async (spaceId) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/cabinets/approved?spaceId=${spaceId}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setCabinets(data);
      } else {
        console.error('Failed to fetch cabinets');
        message.error('Failed to load cabinets');
      }
    } catch (error) {
      console.error('Error fetching cabinets:', error);
      message.error('Failed to load cabinets');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all cabinets
  const fetchCabinets = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/cabinets`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setCabinets(data);
      } else {
        console.error('Failed to fetch cabinets');
      }
    } catch (error) {
      console.error('Error fetching cabinets:', error);
    }
  };

  // Fetch unallocated files
  const fetchUnallocatedFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/unallocated`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnallocatedFiles(data);
      } else {
        console.error('Failed to fetch unallocated files');
      }
    } catch (error) {
      console.error('Error fetching unallocated files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cabinet fields when a cabinet is selected
  useEffect(() => {
    if (selectedCabinetId) {
      fetchCabinetFields(selectedCabinetId);
    }
  }, [selectedCabinetId]);

  const fetchCabinetFields = async (cabinetId) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/cabinets/${cabinetId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.customFields) {
          setCabinetFields(data.customFields);
        }
      } else {
        console.error('Failed to fetch cabinet fields');
        message.error('Failed to fetch cabinet fields');
      }
    } catch (error) {
      console.error('Error fetching cabinet fields:', error);
      message.error('Error fetching cabinet fields');
    } finally {
      setLoading(false);
    }
  };

  // Extract fields from a file
  const extractFieldsFromFile = async (fileId) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/extract-fields/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setProcessingFile({ id: fileId });
        setExtractedFields(data.extractedFields);
        
        // Auto-generate field mappings based on similarity
        if (data.extractedFields && cabinetFields.length > 0) {
          const mappings = {};
          data.extractedFields.forEach(extractedField => {
            const bestMatch = findBestMatch(extractedField.name, cabinetFields);
            if (bestMatch) {
              mappings[bestMatch.id] = extractedField.value;
            }
          });
          setFieldMappings(mappings);
        }
        
        setIsModalVisible(true);
      } else {
        message.error('Failed to extract fields from document');
      }
    } catch (error) {
      console.error('Error extracting fields:', error);
      message.error('Failed to extract fields');
    } finally {
      setLoading(false);
    }
  };

  // Find best match between extracted field and cabinet fields
  const findBestMatch = (extractedFieldName, cabinetFields) => {
    let bestMatch = null;
    let highestScore = 0;

    cabinetFields.forEach(field => {
      const score = calculateSimilarity(extractedFieldName.toLowerCase(), field.name.toLowerCase());
      
      if (score > highestScore && score > 0.5) { // 0.5 is the threshold for a "match"
        highestScore = score;
        bestMatch = field;
      }
    });

    return bestMatch;
  };

  // Simple similarity calculation between two strings
  const calculateSimilarity = (str1, str2) => {
    // Check for exact match
    if (str1 === str2) return 1.0;
    
    // Check if one string contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }
    
    // Check for word overlap
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    let matches = 0;
    for (const word1 of words1) {
      if (word1.length < 3) continue; // Skip short words
      for (const word2 of words2) {
        if (word2.length < 3) continue; // Skip short words
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          matches++;
          break;
        }
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  };

  const handleCabinetChange = (value) => {
    setSelectedCabinetId(value);
    setFieldMappings({}); // Reset mappings when cabinet changes
  };

  const handleFieldMappingChange = (cabinetFieldId, extractedValue) => {
    setFieldMappings({ 
      ...fieldMappings, 
      [cabinetFieldId]: extractedValue 
    });
  };

  const handleSaveToUnallocated = async () => {
    try {
      setLoading(true);
      
      // If files are already uploaded and we have their IDs, mark them as unallocated
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/unallocated/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          fileIds: uploadedFiles.map(file => file.id)
        })
      });
      
      if (response.ok) {
        message.success('Files saved to unallocated files');
        setActionModalVisible(false);
        setUploadedFiles([]);
        
        // Refresh unallocated files list
        fetchUnallocatedFiles();
        
        if (onFilesUploaded) {
          onFilesUploaded(uploadedFiles);
        }
      } else {
        message.error('Failed to save files');
      }
    } catch (error) {
      console.error('Error saving files to unallocated:', error);
      message.error('Failed to save files');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecordFromUploaded = () => {
    setActionModalVisible(false);
    // Instead of directly showing file selection, first show space selection modal
    setSpaceSelectionModalVisible(true);
  };
  
  const handleFileSelect = (selectedRowKeys) => {
    setSelectedFiles(selectedRowKeys);
  };

  const handleSpaceSelect = (spaceId) => {
    setSelectedSpaceId(spaceId);
  };

  const handleCabinetSelect = async (cabinetId) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/cabinets/${cabinetId}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const cabinet = await response.json();
        setSelectedCabinetId(cabinetId);
        setCabinetFields(cabinet.customFields || []);
        
        // Close space selection modal and open file selection modal
        setSpaceSelectionModalVisible(false);
        setSelectFilesModalVisible(true);
      } else {
        message.error('Failed to fetch cabinet details');
      }
    } catch (error) {
      console.error('Error fetching cabinet details:', error);
      message.error('Failed to load cabinet details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async () => {
    try {
      setLoading(true);
      
      if (!selectedCabinetId) {
        message.error('Please select a cabinet');
        setLoading(false);
        return;
      }
      
      if (Object.keys(fieldMappings).length === 0) {
        message.error('Please map at least one field');
        setLoading(false);
        return;
      }
      
      const fileIds = processingFile ? [processingFile.id] : selectedFiles;
      
      if (!fileIds.length) {
        message.error('Please select at least one file');
        setLoading(false);
        return;
      }
      
      // Prepare record data
      const recordData = {
        cabinetId: selectedCabinetId,
        fields: Object.entries(fieldMappings).map(([fieldId, value]) => ({
          fieldId,
          value
        })),
        fileIds: fileIds // Support for multiple files
      };
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/records/with-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(recordData)
      });
      
      if (response.ok) {
        const data = await response.json();
        message.success('Record created successfully');
        
        setIsModalVisible(false);
        setSelectFilesModalVisible(false);
        setExtractedFields(null);
        setFieldMappings({});
        setSelectedFiles([]);
        
        // Refresh unallocated files as some may have been assigned to the record
        fetchUnallocatedFiles();
        
        // Notify parent component if callback provided
        if (onRecordCreated) {
          onRecordCreated(data);
        }
      } else {
        const errorData = await response.json();
        message.error(`Failed to create record: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating record:', error);
      message.error('Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  // Get match quality tag for a field mapping
  const getMatchQualityTag = (extractedField, cabinetField) => {
    const score = calculateSimilarity(
      extractedField.name.toLowerCase(), 
      cabinetField.name.toLowerCase()
    );
    
    if (score >= 0.8) return <Tag color="green">Exact Match (100%)</Tag>;
    if (score >= 0.6) return <Tag color="blue">Partial Match (70%)</Tag>;
    return <Tag color="orange">Low Match (50%)</Tag>;
  };

  const fileColumns = [
    {
      title: 'File Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size) => `${Math.round(size / 1024)} KB`
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Upload Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString()
    }
  ];

  const handleStartRecordCreation = async () => {
    if (!selectedCabinetId) {
      message.error('Please select a cabinet first');
      return;
    }
    
    if (selectedFiles.length === 0) {
      message.error('Please select at least one file');
      return;
    }
    
    // Extract fields from the first selected file
    await extractFieldsFromFile(selectedFiles[0]);
  };

  return (
    <>
      <Card title="Upload Files" className="mb-6">
        {uppyInstance.current && (
          <Dashboard
            uppy={uppyInstance.current}
            proudlyDisplayPoweredByUppy={false}
            height={300}
            width="100%"
            showLinkToFileUploadResult={false}
            note="Drag and drop PDF files here or click to browse. Files will be uploaded to secure cloud storage. You can upload up to 100 files at once."
            disabled={loading}
          />
        )}

        {loading && (
          <div className="mt-4 text-center">
            <Spin>
              <div className="content" style={{ padding: '30px', textAlign: 'center' }}>
                <p>Processing...</p>
              </div>
            </Spin>
          </div>
        )}
      </Card>
      
      <Card title="Unallocated Files" className="mb-6">
        <div className="mb-4 flex justify-between items-center">
          <Text>These files haven't been assigned to any records yet.</Text>
          <Button 
            type="primary" 
            onClick={() => setSpaceSelectionModalVisible(true)}
            disabled={unallocatedFiles.length === 0}
          >
            Create Record with Selected Files
          </Button>
        </div>
        
        <Table 
          dataSource={unallocatedFiles} 
          columns={fileColumns}
          rowKey="id"
          rowSelection={{
            onChange: handleFileSelect
          }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
      
      {/* Modal for action selection after upload */}
      <Modal
        title="Files Uploaded Successfully"
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        footer={null}
      >
        <p>Your files have been uploaded to secure cloud storage. What would you like to do next?</p>
        <div className="flex justify-between mt-6">
          <Button 
            onClick={handleSaveToUnallocated}
            size="large"
            icon="⚪"
          >
            Save to Unallocated Files
          </Button>
          <Button 
            type="primary" 
            onClick={handleCreateRecordFromUploaded}
            size="large"
          >
            Create Record with Files
          </Button>
        </div>
      </Modal>

      {/* Space & Cabinet Selection Modal */}
      <Modal
        title="Select Space and Cabinet"
        open={spaceSelectionModalVisible}
        onCancel={() => setSpaceSelectionModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 1: Space Selection */}
          <div>
            <Text strong>Step 1: Choose Space</Text>
            <div style={{ marginTop: '8px', marginBottom: '16px' }}>
              <Text type="secondary">Select a space to view its cabinets</Text>
            </div>
            <Select
              placeholder="Select a space"
              style={{ width: '100%' }}
              loading={loadingSpaces}
              value={selectedSpaceId}
              onChange={handleSpaceSelect}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                option?.label?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
              }
              options={spaces.map(space => ({
                value: space.id,
                label: space.name
              }))}
            />
          </div>

          {/* Step 2: Cabinet Selection */}
          {selectedSpaceId && (
            <div>
              <Text strong>Step 2: Choose Cabinet</Text>
              <div style={{ marginTop: '8px', marginBottom: '16px' }}>
                <Text type="secondary">Select a cabinet from {spaces.find(s => s.id === selectedSpaceId)?.name}</Text>
              </div>
              <Select
                placeholder="Select a cabinet"
                style={{ width: '100%' }}
                loading={loading}
                onChange={handleCabinetSelect}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  option?.label?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
                }
                options={cabinets.map(cabinet => ({
                  value: cabinet.id,
                  label: cabinet.name
                }))}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal for file selection */}
      <Modal
        title="Select Files for Record"
        open={selectFilesModalVisible}
        onCancel={() => setSelectFilesModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSelectFilesModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="create" 
            type="primary" 
            onClick={handleStartRecordCreation}
            loading={loading}
            disabled={selectedFiles.length === 0 || !selectedCabinetId}
          >
            Next: Extract Fields
          </Button>
        ]}
        width={800}
      >
        <div className="mb-4">
          <Text type="secondary">
            Select the files you want to include in your record.
          </Text>
        </div>

        <div className="mb-4">
          <Text strong>Selected Cabinet: </Text>
          <Text>{cabinets.find(cab => cab.id === selectedCabinetId)?.name}</Text>
        </div>

        <Table 
          dataSource={uploadedFiles.length > 0 ? uploadedFiles : unallocatedFiles} 
          columns={fileColumns}
          rowKey="id"
          rowSelection={{
            onChange: handleFileSelect
          }}
          pagination={{ pageSize: 5 }}
        />
      </Modal>
      
      {/* Modal for field mapping */}
      <Modal
        title="Match Extracted Fields"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="create" 
            type="primary" 
            onClick={handleCreateRecord}
            loading={loading}
            disabled={!selectedCabinetId || Object.keys(fieldMappings).length === 0}
          >
            Create Record
          </Button>
        ]}
        width={700}
      >
        <div className="mb-4">
          <Text type="secondary">
            The system has extracted fields from your document. Please review and confirm the mappings below.
          </Text>
        </div>

        {cabinetFields.length > 0 && (
          <List
            itemLayout="vertical"
            dataSource={cabinetFields}
            renderItem={cabinetField => {
              const matchingExtractedField = extractedFields?.find(ef => {
                const similarity = calculateSimilarity(
                  ef.name.toLowerCase(), 
                  cabinetField.name.toLowerCase()
                );
                return similarity > 0.5;
              });
              
              return (
                <List.Item>
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <Text strong>{cabinetField.name}</Text>
                      {matchingExtractedField && 
                        getMatchQualityTag(matchingExtractedField, cabinetField)
                      }
                    </div>
                    
                    <Select
                      className="w-full"
                      placeholder="Select extracted value or enter manually"
                      value={fieldMappings[cabinetField.id]}
                      onChange={(value) => handleFieldMappingChange(cabinetField.id, value)}
                      showSearch
                      allowClear
                    >
                      {extractedFields?.map(field => (
                        <Option key={field.name} value={field.value}>
                          {field.name}: {field.value}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
        
        <div className="mt-4">
          <Text strong>Selected Files: {selectedFiles.length || (processingFile ? 1 : 0)}</Text>
        </div>
      </Modal>
    </>
  );
};

export default UploadFiles;

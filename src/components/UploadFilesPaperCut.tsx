'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Spin, Table, Typography, Modal, message, Image as AntImage, Alert, Tooltip, Select, Space, List, Progress } from 'antd';
import type { TableProps } from 'antd';
import { Document, Page, pdfjs } from 'react-pdf';
import { v4 as uuidv4 } from 'uuid';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { ZoomInOutlined, ZoomOutOutlined, UndoOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, UploadOutlined, SyncOutlined } from '@ant-design/icons';
import '@uppy/core/dist/style.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `/lib/pdfjs/pdf.worker.min.mjs`;

interface SignatureData { id: string; r2Url: string; name?: string; createdAt: string }
interface StampData { id: string; r2Url: string; name?: string; createdAt: string }
interface UnallocatedFile { id: string; name: string; url: string; size: number; mimetype: string; userId: string; isAllocated: boolean; createdAt: string; updatedAt: string }
interface PlacedItem { id: string; type: 'signature' | 'stamp'; url: string; pageNumber: number; xPct: number; yPct: number; widthPct: number; heightPct: number }
interface PlacingItemInfo { type: 'signature' | 'stamp'; url: string; width: number; height: number }
interface PlacementInfoForBackend { type: 'signature' | 'stamp'; url: string; pageNumber: number; x: number; y: number; width: number; height: number }
interface SaveSignedLetterPayload_Interactive { originalFileId: string; placements: PlacementInfoForBackend[]; reviewers?: string[]; approver?: string; name?: string }
interface SavedLetterResponse { id: string; letterUrl: string }
type UppyMetaData = { storage: string; markAsUnallocated: boolean }
type UppyBody = Record<string, unknown>
interface UserOption { value: string; label: string }

async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const config: RequestInit = { method, headers, credentials: 'include' }
    if (body) config.body = JSON.stringify(body)
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}${endpoint}`, config)
    if (!response.ok) {
        let errorData: any = { message: `HTTP error! status: ${response.status}` }
        try { errorData = await response.json() } catch {}
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
}

const UploadAndSignPdf: React.FC = () => {
    const [unallocatedFiles, setUnallocatedFiles] = useState<UnallocatedFile[]>([])
    const [loadingFiles, setLoadingFiles] = useState<boolean>(false)
    const [selectedFileIds, setSelectedFileIds] = useState<React.Key[]>([])
    const [signModalVisible, setSignModalVisible] = useState<boolean>(false)
    const [processingFile, setProcessingFile] = useState<UnallocatedFile | null>(null)
    const [savedSignatures, setSavedSignatures] = useState<SignatureData[]>([])
    const [savedStamps, setSavedStamps] = useState<StampData[]>([])
    const [isSavingLetter, setIsSavingLetter] = useState<boolean>(false)
    const uppyInstance = useRef<Uppy<UppyMetaData, UppyBody> | null>(null)
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pageNumber, setPageNumber] = useState<number>(1)
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null)
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
    const [placingItem, setPlacingItem] = useState<PlacingItemInfo | null>(null)
    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null)
    const [selectedStampUrl, setSelectedStampUrl] = useState<string | null>(null)
    const [approverOptions, setApproverOptions] = useState<UserOption[]>([])
    const [selectedApprover, setSelectedApprover] = useState<string | null>(null)
    const [pdfScale, setPdfScale] = useState<number>(1)
    const ZOOM_STEP = 0.2
    const MIN_SCALE = 0.4
    const MAX_SCALE = 3
    const [allReviewerOptions, setAllReviewerOptions] = useState<UserOption[]>([])
    const [selectedReviewers, setSelectedReviewers] = useState<string[]>([])
    const [reviewerToAdd, setReviewerToAdd] = useState<string | null>(null)
    const [loadingReviewers, setLoadingReviewers] = useState<boolean>(false)
    const MAX_REVIEWERS = 5
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState<boolean>(false)
    const [uploadProgress, setUploadProgress] = useState<number>(0)
    const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
    const [pageDimensions, setPageDimensions] = useState<{ [key: number]: { width: number; height: number } }>({})

    const fetchUnallocatedFiles = useCallback(async () => {
        setLoadingFiles(true)
        try {
            const data = await apiRequest<UnallocatedFile[]>('/files/unallocated', 'GET')
            setUnallocatedFiles(data.filter(f => !f.isAllocated && f.url))
        } catch (error: any) {
            console.error(error)
            message.error(`Failed to load files: ${error.message}`)
            setUnallocatedFiles([])
        } finally { setLoadingFiles(false) }
    }, [])

    const fetchAllReviewers = useCallback(async () => {
        setLoadingReviewers(true)
        try {
            const data = await apiRequest<UserOption[]>('/users/reviewers', 'GET')
            setAllReviewerOptions(data)
        } catch (error: any) {
            console.error(error)
            message.error(`Failed to load reviewers: ${error.message}`)
            setAllReviewerOptions([])
        } finally { setLoadingReviewers(false) }
    }, [])

    const fetchApprovers = useCallback(async () => {
        try {
            const data = await apiRequest<UserOption[]>('/users/approvers', 'GET')
            setApproverOptions(data)
        } catch (error: any) {
            console.error(error)
            message.error(`Failed to load approvers: ${error.message}`)
            setApproverOptions([])
        }
    }, [])

    useEffect(() => {
        if (!uppyInstance.current && typeof window !== 'undefined') {
            const uppy = new Uppy<UppyMetaData, UppyBody>({
                restrictions: { maxFileSize: 15 * 1024 * 1024, maxNumberOfFiles: 5, allowedFileTypes: ['application/pdf'] },
                autoProceed: true,
                meta: { storage: 'cloudflare_r2', markAsUnallocated: true }
            }).use(XHRUpload, {
                endpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/files/upload`,
                formData: true,
                fieldName: 'files',
                bundle: false,
                headers: () => {
                    const h: Record<string, string> = {}
                    return h
                }
            })

            uppy.on('upload', () => {
                setIsUploading(true)
                setUploadProgress(0)
            })

            uppy.on('upload-progress', () => {
                const totalProgress = uppy.getState().totalProgress || 0
                setUploadProgress(totalProgress)
            })

            uppy.on('upload-success', file => {
                if (file) {
                    message.success(`${file.name} uploaded`)
                } else {
                    message.success(`File uploaded successfully`)
                }
                fetchUnallocatedFiles()
            })

            uppy.on('complete', () => {
                setIsUploading(false)
                setUploadProgress(0)
                setUploadingFileName(null)
            })

            uppyInstance.current = uppy
        }
        return () => {
            if (uppyInstance.current) {
                uppyInstance.current.cancelAll()
                uppyInstance.current = null
            }
        }
    }, [fetchUnallocatedFiles])

    useEffect(() => { fetchUnallocatedFiles() }, [fetchUnallocatedFiles])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const sigsRaw = localStorage.getItem('signatures_r2') || '[]'
                const parsed = JSON.parse(sigsRaw)
                if (Array.isArray(parsed)) setSavedSignatures(parsed.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt })))
            } catch {}
            try {
                const stmpsRaw = localStorage.getItem('stamps_r2') || '[]'
                const parsed2 = JSON.parse(stmpsRaw)
                if (Array.isArray(parsed2)) setSavedStamps(parsed2.map((s: any) => ({ id: s.id, r2Url: s.url || s.r2Url, name: s.name, createdAt: s.createdAt })))
            } catch {}
        }
    }, [])

    const handleFileSelectionChange = (keys: React.Key[]) => setSelectedFileIds(keys)

    const handleOpenSignModal = () => {
        if (selectedFileIds.length !== 1) { message.warning('Select one file'); return }
        const file = unallocatedFiles.find(f => f.id === selectedFileIds[0])
        if (!file || !file.url) { message.error('File not found'); return }
        setProcessingFile(file)
        setSignModalVisible(true)
        setPlacedItems([])
        setPlacingItem(null)
        setSelectedSignatureUrl(null)
        setSelectedStampUrl(null)
        setNumPages(null)
        setPageNumber(1)
        setPdfLoadError(null)
        setPdfScale(1)
        setSelectedReviewers([])
        setReviewerToAdd(null)
        setSelectedApprover(null)
        fetchAllReviewers()
        fetchApprovers()
    }

    const handleCloseSignModal = () => {
        setSignModalVisible(false)
        setTimeout(() => {
            setProcessingFile(null)
            setPlacedItems([])
            setPlacingItem(null)
            setSelectedSignatureUrl(null)
            setSelectedStampUrl(null)
            setNumPages(null)
            setPageNumber(1)
            setPdfLoadError(null)
            setPdfScale(1)
            setSelectedReviewers([])
            setAllReviewerOptions([])
            setReviewerToAdd(null)
            setApproverOptions([])
            setSelectedApprover(null)
            setPageDimensions({})
        }, 300)
    }

    const handleSelectSignatureForPlacing = (sig: SignatureData) => {
        setPlacingItem({ type: 'signature', url: sig.r2Url, width: 100, height: 40 })
        setSelectedSignatureUrl(sig.r2Url)
        setSelectedStampUrl(null)
    }

    const handleSelectStampForPlacing = (stamp: StampData) => {
        setPlacingItem({ type: 'stamp', url: stamp.r2Url, width: 60, height: 60 })
        setSelectedStampUrl(stamp.r2Url)
        setSelectedSignatureUrl(null)
    }

    const handlePdfAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!placingItem || !processingFile) return
        const wrapper = event.currentTarget
        const rect = wrapper.getBoundingClientRect()
        const dims = pageDimensions[pageNumber]
        if (!dims) return
        const renderedW = dims.width * pdfScale
        const renderedH = dims.height * pdfScale
        const offsetX = (wrapper.clientWidth - renderedW) / 2
        const clickX = event.clientX - rect.left - offsetX + wrapper.scrollLeft
        const clickY = event.clientY - rect.top + wrapper.scrollTop
        if (clickX < 0 || clickY < 0 || clickX > renderedW || clickY > renderedH) return
        const xPct = clickX / renderedW
        const yPct = clickY / renderedH
        const widthPct = placingItem.width / dims.width
        const heightPct = placingItem.height / dims.height
        const newItem: PlacedItem = { id: uuidv4(), type: placingItem.type, url: placingItem.url, pageNumber, xPct, yPct, widthPct, heightPct }
        setPlacedItems(prev => [...prev, newItem])
        setPlacingItem(null)
    }

    const handleRemovePlacedItem = (id: string) => setPlacedItems(prev => prev.filter(i => i.id !== id))

    const handleApproverChange = (value: string | null) => setSelectedApprover(value)

    const handleSaveSignedLetter = async () => {
        if (!processingFile) { message.error('No file'); return }
        if (!placedItems.some(i => i.type === 'signature') || !placedItems.some(i => i.type === 'stamp')) { message.warning('Add signature and stamp'); return }
        if (selectedReviewers.length === 0) { message.warning('Add reviewer'); return }

        const placementsForBackend: PlacementInfoForBackend[] = placedItems.map(item => {
            const dims = pageDimensions[item.pageNumber]
            const x = item.xPct * dims.width
            const y = item.yPct * dims.height
            const width = item.widthPct * dims.width
            const height = item.heightPct * dims.height
            return { type: item.type, url: item.url, pageNumber: item.pageNumber, x, y, width, height }
        })

        const payload: SaveSignedLetterPayload_Interactive = {
            originalFileId: processingFile.id,
            placements: placementsForBackend,
            reviewers: selectedReviewers,
            approver: selectedApprover ?? undefined,
            name: processingFile.name
        }

        try {
            setIsSavingLetter(true)
            const saved = await apiRequest<SavedLetterResponse>('/letters/from-pdf-interactive', 'POST', payload)
            message.success(`Letter created (${saved.id})`)
            handleCloseSignModal()
            setSelectedFileIds([])
            fetchUnallocatedFiles()
        } catch (error: any) {
            console.error(error)
            message.error(error.message)
        } finally { setIsSavingLetter(false) }
    }

    const handleAddReviewer = () => {
        if (!reviewerToAdd) { message.warning('Select reviewer'); return }
        if (selectedReviewers.includes(reviewerToAdd)) { message.warning('Already added'); setReviewerToAdd(null); return }
        if (selectedReviewers.length >= MAX_REVIEWERS) { message.warning(`Max ${MAX_REVIEWERS}`); return }
        setSelectedReviewers(prev => [...prev, reviewerToAdd])
        setReviewerToAdd(null)
    }

    const handleRemoveReviewer = (idx: number) => setSelectedReviewers(prev => prev.filter((_, i) => i !== idx))

    const handleMoveReviewer = (idx: number, dir: 'up' | 'down') => {
        if (dir === 'up' && idx === 0) return
        if (dir === 'down' && idx === selectedReviewers.length - 1) return
        const list = [...selectedReviewers]
        const swap = dir === 'up' ? idx - 1 : idx + 1
        ;[list[idx], list[swap]] = [list[swap], list[idx]]
        setSelectedReviewers(list)
    }

    const handleZoomIn = () => setPdfScale(prev => Math.min(prev + ZOOM_STEP, MAX_SCALE))
    const handleZoomOut = () => setPdfScale(prev => Math.max(prev - ZOOM_STEP, MIN_SCALE))
    const handleResetZoom = () => setPdfScale(1)

    const availableReviewerOptions = allReviewerOptions.filter(o => !selectedReviewers.includes(o.value))
    const getReviewerLabel = (id: string) => allReviewerOptions.find(o => o.value === id)?.label || 'Unknown'

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!uppyInstance.current) { message.error('Uploader not ready'); return }
        const files = Array.from(e.target.files || [])
        files.forEach(f => {
            uppyInstance.current?.addFile({ source: 'react-file-input', name: f.name, type: f.type, data: f, meta: { storage: 'cloudflare_r2', markAsUnallocated: true } })
            setUploadingFileName(f.name)
        })
        e.target.value = ''
    }

    const fileColumns: TableProps<UnallocatedFile>['columns'] = [
        { title: 'File Name', dataIndex: 'name', key: 'name', ellipsis: true, render: name => <Typography.Text title={name}>{name}</Typography.Text> },
        { title: 'Size', dataIndex: 'size', key: 'size', width: 100, render: size => size ? `${Math.round(size / 1024)} KB` : '-' },
        { title: 'Type', dataIndex: 'mimetype', key: 'mimetype', width: 130 },
        { title: 'Upload Date', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: d => d ? new Date(d).toLocaleString() : '-' }
    ]

    const rowSelection = { selectedRowKeys: selectedFileIds, onChange: handleFileSelectionChange, type: 'checkbox' as const }

    const canSaveChanges = placedItems.some(i => i.type === 'signature') && placedItems.some(i => i.type === 'stamp')

    return (
        <div className="space-y-6">
            <Card title="1. Upload PDF Files">
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} multiple accept="application/pdf" disabled={isUploading} />
                <Button type="primary" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} disabled={isUploading} loading={isUploading}>
                    {isUploading ? 'Uploading...' : 'Click to upload PDF(s)'}
                </Button>
                <Typography.Text type="secondary" style={{ marginLeft: 15 }}>Max 5 files, 15MB each.</Typography.Text>
                {isUploading && <div style={{ marginTop: 15 }}><Typography.Text>Uploading {uploadingFileName || 'files'}...</Typography.Text><Progress percent={uploadProgress} status="active" /></div>}
            </Card>

            <Card title="2. Select File and Add Signature/Stamp" actions={[<Button key="refresh" type="text" onClick={fetchUnallocatedFiles} icon={<SyncOutlined />} title="Refresh File List" />]}>
                <div className="mb-4 space-x-4">
                    <Button type="primary" onClick={handleOpenSignModal} disabled={selectedFileIds.length !== 1 || loadingFiles}>Sign & Stamp Selected File</Button>
                    <Typography.Text type="secondary">{selectedFileIds.length === 0 ? 'Select one file' : selectedFileIds.length === 1 ? '1 file selected' : `${selectedFileIds.length} selected`}</Typography.Text>
                </div>
                <Table rowKey="id" dataSource={unallocatedFiles} columns={fileColumns} loading={loadingFiles} rowSelection={rowSelection} pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }} scroll={{ y: 350 }} size="middle" />
            </Card>

            <Modal
                title={<Typography.Text ellipsis={{ tooltip: processingFile?.name }}>Sign & Stamp: {processingFile?.name || 'File'}</Typography.Text>}
                open={signModalVisible}
                onCancel={handleCloseSignModal}
                width={1000}
                destroyOnClose
                footer={[
                    <Button key="back" onClick={handleCloseSignModal} disabled={isSavingLetter}>Cancel</Button>,
                    <Button key="submit" type="primary" loading={isSavingLetter} onClick={handleSaveSignedLetter} disabled={!canSaveChanges}>Save Signed Letter</Button>
                ]}
            >
                <div className="flex flex-col md:flex-row gap-4 p-1 max-h-[75vh] overflow-hidden">
                    <div className="flex-1 flex flex-col border border-gray-300 rounded-md overflow-hidden bg-gray-100">
                        <div className="flex justify-between items-center p-2 bg-gray-200 border-b border-gray-300 sticky top-0 z-10">
                            <div>
                                {numPages && numPages > 1 && <Space><Button onClick={() => setPageNumber(p => Math.max(p - 1, 1))} disabled={pageNumber <= 1} size="small">Previous</Button><span>Page {pageNumber} of {numPages}</span><Button onClick={() => setPageNumber(p => Math.min(p + 1, numPages))} disabled={pageNumber >= numPages} size="small">Next</Button></Space>}
                                {!numPages && pdfLoadError && <span className="text-red-500 text-xs">Page info unavailable</span>}
                                {!numPages && !pdfLoadError && processingFile?.url && <span className="text-gray-500 text-xs">Loading page info...</span>}
                            </div>
                            <Space>
                                <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={pdfScale <= MIN_SCALE || !numPages} size="small" />
                                <Tooltip title="Reset Zoom"><Button icon={<UndoOutlined />} onClick={handleResetZoom} disabled={pdfScale === 1 || !numPages} size="small" /></Tooltip>
                                <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={pdfScale >= MAX_SCALE || !numPages} size="small" />
                                <span className="text-sm font-semibold w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                            </Space>
                        </div>

                        <div className="flex-1 overflow-auto p-2 relative" onClick={handlePdfAreaClick} style={{ cursor: placingItem ? 'copy' : 'default' }}>
                            {processingFile?.url ? (
                                <>
                                    {pdfLoadError && <Alert message="Error loading PDF" description={pdfLoadError} type="error" showIcon className="m-4" />}
                                    <Document file={processingFile.url} onLoadSuccess={({ numPages: total }) => { setNumPages(total); setPdfLoadError(null) }} onLoadError={e => { console.error(e); setPdfLoadError(e.message); setNumPages(null) }}>
                                        <Page
                                            key={`page_${pageNumber}_${pdfScale}`}
                                            pageNumber={pageNumber}
                                            scale={pdfScale}
                                            onLoadSuccess={pdfPage => {
                                                const viewport = pdfPage.getViewport({ scale: 1 })
                                                setPageDimensions(prev => ({ ...prev, [pageNumber]: { width: viewport.width, height: viewport.height } }))
                                            }}
                                            renderTextLayer
                                            renderAnnotationLayer
                                            className="shadow-lg"
                                            loading={<div style={{ height: 500 }}><Spin /></div>}
                                            error={<div className="text-red-500">Failed to render page</div>}
                                        />
                                        {placedItems.filter(i => i.pageNumber === pageNumber).map(item => {
                                            const dims = pageDimensions[item.pageNumber]
                                            if (!dims) return null
                                            const left = item.xPct * dims.width * pdfScale
                                            const top = item.yPct * dims.height * pdfScale
                                            const width = item.widthPct * dims.width * pdfScale
                                            const height = item.heightPct * dims.height * pdfScale
                                            return (
                                                <Tooltip key={item.id} title="Click to remove">
                                                    <img src={item.url} alt={item.type} style={{ position: 'absolute', left, top, width, height, cursor: 'pointer', border: '1px dashed rgba(128,128,128,0.7)', objectFit: 'contain', userSelect: 'none', transformOrigin: 'top left' }} onClick={e => { e.stopPropagation(); handleRemovePlacedItem(item.id) }} />
                                                </Tooltip>
                                            )
                                        })}
                                    </Document>
                                </>
                            ) : <div className="text-center p-10"><Typography.Text type="secondary">No PDF selected</Typography.Text></div>}
                        </div>
                    </div>

                    <div className="w-full md:w-1/3 space-y-4 p-2 overflow-y-auto">
                        {placingItem && <Alert message={`Click on the PDF to place the selected ${placingItem.type}`} type="info" showIcon closable onClose={() => setPlacingItem(null)} />}
                        {!placingItem && placedItems.length > 0 && <Alert message="Click on an item to remove it" type="info" showIcon />}

                        <div>
                            <Typography.Title level={5} style={{ marginBottom: 8 }}>Select Signature</Typography.Title>
                            {savedSignatures.length === 0 ? <Typography.Text type="secondary">No signatures saved...</Typography.Text> : <div className="flex flex-wrap gap-2">{savedSignatures.map(sig => <button key={sig.id} type="button" onClick={() => handleSelectSignatureForPlacing(sig)} className={`p-1 border rounded-md transition-all ${selectedSignatureUrl === sig.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`} title={sig.name || 'Signature'}><AntImage src={sig.r2Url} alt={sig.name || 'Signature'} width={80} height={35} preview={false} className="object-contain" /></button>)}</div>}
                        </div>

                        <div>
                            <Typography.Title level={5} style={{ marginBottom: 8 }}>Select Stamp</Typography.Title>
                            {savedStamps.length === 0 ? <Typography.Text type="secondary">No stamps saved...</Typography.Text> : <div className="flex flex-wrap gap-2">{savedStamps.map(stamp => <button key={stamp.id} type="button" onClick={() => handleSelectStampForPlacing(stamp)} className={`p-1 border rounded-full transition-all ${selectedStampUrl === stamp.r2Url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}`} title={stamp.name || 'Stamp'}><AntImage src={stamp.r2Url} alt={stamp.name || 'Stamp'} width={45} height={45} preview={false} className="object-contain rounded-full" /></button>)}</div>}
                        </div>

                        {placedItems.length > 0 && (
                            <div>
                                <Typography.Title level={5} style={{ marginBottom: 8 }}>Placed Items</Typography.Title>
                                <List size="small" bordered dataSource={placedItems} renderItem={item => <List.Item actions={[<Button type="link" danger size="small" onClick={() => handleRemovePlacedItem(item.id)}>Remove</Button>]}><List.Item.Meta title={`${item.type.charAt(0).toUpperCase() + item.type.slice(1)} on page ${item.pageNumber}`} /></List.Item>} />
                            </div>
                        )}

                        <div>
                            <Typography.Title level={5} style={{ marginBottom: 8 }}>Add Reviewer / Approver</Typography.Title>
                            <Space.Compact style={{ width: '100%' }}>
                                <Select style={{ width: '100%' }} placeholder="Find reviewer..." showSearch allowClear value={reviewerToAdd} onChange={setReviewerToAdd} options={availableReviewerOptions} loading={loadingReviewers} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} disabled={selectedReviewers.length >= MAX_REVIEWERS} />
                                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddReviewer} disabled={!reviewerToAdd || selectedReviewers.length >= MAX_REVIEWERS} />
                            </Space.Compact>
                            {selectedReviewers.length >= MAX_REVIEWERS && !reviewerToAdd && <Typography.Text type="warning" className="text-xs block mt-1">Maximum {MAX_REVIEWERS} reviewers reached.</Typography.Text>}
                            {selectedReviewers.length > 0 && <List size="small" header={<Typography.Text strong>Review Order:</Typography.Text>} bordered dataSource={selectedReviewers} renderItem={(rev, i) => <List.Item actions={[<Tooltip title="Move Up"><Button shape="circle" icon={<ArrowUpOutlined />} size="small" onClick={() => handleMoveReviewer(i, 'up')} disabled={i === 0} /></Tooltip>, <Tooltip title="Move Down"><Button shape="circle" icon={<ArrowDownOutlined />} size="small" onClick={() => handleMoveReviewer(i, 'down')} disabled={i === selectedReviewers.length - 1} /></Tooltip>, <Tooltip title="Remove"><Button danger shape="circle" icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveReviewer(i)} /></Tooltip>]}><List.Item.Meta title={`${i + 1}. ${getReviewerLabel(rev)}`} /></List.Item>} className="mt-3" />}
                        </div>

                        <div>
                            <Typography.Title level={5} style={{ marginBottom: 8 }}>Add Final Approver</Typography.Title>
                            <Select style={{ width: '100%' }} placeholder="Select Approver" value={selectedApprover} onChange={handleApproverChange} options={approverOptions} allowClear showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default UploadAndSignPdf

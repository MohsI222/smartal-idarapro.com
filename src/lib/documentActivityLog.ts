/** Server-side activity log for generated documents (dashboard stats UX). */

import { api } from './api';

export type DocumentActivityEntry = {
  id: string;
  at: string;
  kind: string;
  title: string;
  filename?: string;
  file_size?: number;
};

// Cache for exported documents to avoid frequent API calls
let cachedDocuments: DocumentActivityEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function pushDocumentActivity(kind: string, title: string, token: string, filename?: string, file_size?: number): Promise<void> {
  try {
    await api('/exported-documents', {
      method: 'POST',
      token,
      body: JSON.stringify({
        document_kind: kind,
        title: title.slice(0, 200),
        filename: filename || '',
        file_size: file_size || null,
        export_timestamp: new Date().toISOString(),
        metadata: {},
      }),
    });
    
    // Invalidate cache
    cachedDocuments = null;
    window.dispatchEvent(new CustomEvent("idara-doc-activity"));
  } catch (error) {
    console.error('Failed to save document activity to API:', error);
  }
}

export async function readDocumentActivity(token: string): Promise<DocumentActivityEntry[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedDocuments && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedDocuments;
  }
  
  try {
    const response = await api<{ documents: any[] }>('/exported-documents', { token });
    const documents = response.documents || [];
    
    // Transform to DocumentActivityEntry format
    cachedDocuments = documents.map((doc: any) => ({
      id: doc.id,
      at: doc.export_timestamp,
      kind: doc.document_kind,
      title: doc.title,
      filename: doc.filename,
      file_size: doc.file_size,
    }));
    
    cacheTimestamp = now;
    return cachedDocuments;
  } catch (error) {
    console.error('Failed to read document activity from API:', error);
    return [];
  }
}

export async function clearDocumentActivity(token: string): Promise<void> {
  try {
    const documents = await readDocumentActivity(token);
    
    // Delete all documents from API
    for (const doc of documents) {
      await api(`/exported-documents/${doc.id}`, {
        method: 'DELETE',
        token,
      });
    }
    
    // Invalidate cache
    cachedDocuments = null;
    window.dispatchEvent(new CustomEvent("idara-doc-activity"));
  } catch (error) {
    console.error('Failed to clear document activity from API:', error);
  }
}

/**
 * API Client for Shelby Verifiable RAG
 */

import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Get headers with auth
 */
async function getHeaders(): Promise<HeadersInit> {
  const session = await getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.user?.id) {
    headers['x-user-id'] = session.user.id;
  }
  
  return headers;
}

// Types matching our API
export interface Pack {
  pack_id: string;
  owner_user_id: string;
  title: string;
  summary?: string;
  tags?: string[];
  visibility: 'private' | 'public' | 'unlisted';
  created_at: string;
}

export interface Citation {
  shelby_blob_id: string;
  sha256: string;
  snippet?: string;
  doc_path?: string;
  score?: number;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  query_time_ms?: number;
}

// Auth
export async function devLogin(email: string) {
  const res = await fetch(`${API_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Login failed');
  }

  return res.json();
}

// Packs
export async function createPack(formData: FormData) {
  const session = await getSession();
  const headers: HeadersInit = {};
  
  if (session?.user?.id) {
    headers['x-user-id'] = session.user.id;
  }
  
  const res = await fetch(`${API_URL}/packs`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Pack creation failed');
  }

  return res.json();
}

export async function listMyPacks(): Promise<{ items: Pack[] }> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/packs`, {
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to list packs');
  }

  return res.json();
}

export async function getPack(packId: string) {
  const res = await fetch(`${API_URL}/packs/${packId}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to get pack');
  }

  return res.json();
}

export async function updateVisibility(packId: string, visibility: 'private' | 'public' | 'unlisted') {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/packs/${packId}/visibility`, {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify({ visibility }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update visibility');
  }

  return res.json();
}

// Discovery
export async function discoverPacks(query?: string): Promise<{ items: Pack[] }> {
  const url = query 
    ? `${API_URL}/discover?q=${encodeURIComponent(query)}`
    : `${API_URL}/discover`;
    
  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to discover packs');
  }

  return res.json();
}

// Query
export async function queryPrivate(
  question: string,
  packId?: string
): Promise<QueryResponse> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/query`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ question, pack_id: packId }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Query failed');
  }

  return res.json();
}

export async function queryPublic(
  question: string,
  packId: string
): Promise<QueryResponse> {
  const res = await fetch(`${API_URL}/public_query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, pack_id: packId }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Query failed');
  }

  return res.json();
}

// Verification
export async function verifyBlob(blobId: string, expectedSha256?: string) {
  const url = expectedSha256
    ? `${API_URL}/verify/${encodeURIComponent(blobId)}?expected_sha256=${expectedSha256}`
    : `${API_URL}/verify/${encodeURIComponent(blobId)}`;
    
  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Verification failed');
  }

  return res.json();
}

// Delete
export async function deletePack(packId: string) {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/packs/${packId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete pack');
  }

  return res.json();
}

export async function deleteDocument(packId: string, docId: string) {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/packs/${packId}/docs/${docId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete document');
  }

  return res.json();
}


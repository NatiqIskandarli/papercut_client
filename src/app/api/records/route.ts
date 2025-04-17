import { NextResponse } from 'next/server';
import { API_URL } from '@/app/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessToken = localStorage.getItem('access_token_w');

    const response = await fetch(`${API_URL}/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to create record');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating record:', error);
    return NextResponse.json(
      { error: 'Failed to create record' },
      { status: 500 }
    );
  }
} 
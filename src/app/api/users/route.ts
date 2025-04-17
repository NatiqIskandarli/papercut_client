import { NextResponse } from 'next/server';
import axios from 'axios';

// Explicitly marking this route as dynamic
export const dynamic = 'force-dynamic';

// Get all users
export async function GET() {
  try {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
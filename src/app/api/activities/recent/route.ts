import { NextResponse } from 'next/server';

// Explicitly marking this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to fetch real data from the backend
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/activities/recent`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (error) {
      console.error('Error fetching activities from backend:', error);
      // Fall back to mock data
    }

    // If backend request fails, return mock data
    const mockActivities = [
      {
        id: '1',
        user: {
          firstName: 'John',
          lastName: 'Doe',
          avatar: '/images/avatar.png'
        },
        action: 'CREATE',
        resourceType: 'SPACE',
        resourceName: 'Marketing Documents',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
        status: 'completed'
      },
      {
        id: '2',
        user: {
          firstName: 'Jane',
          lastName: 'Smith',
          avatar: '/images/avatar.png'
        },
        action: 'UPDATE',
        resourceType: 'RECORD',
        resourceName: 'Q2 Financial Report',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        status: 'completed'
      },
      {
        id: '3',
        user: {
          firstName: 'Mike',
          lastName: 'Johnson',
          avatar: '/images/avatar.png'
        },
        action: 'APPROVE',
        resourceType: 'CABINET',
        resourceName: 'HR Documents',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        status: 'completed'
      },
      {
        id: '4',
        user: {
          firstName: 'Sarah',
          lastName: 'Williams',
          avatar: '/images/avatar.png'
        },
        action: 'SUBMIT',
        resourceType: 'RECORD',
        resourceName: 'Project Proposal',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        status: 'pending'
      },
      {
        id: '5',
        user: {
          firstName: 'David',
          lastName: 'Brown',
          avatar: '/images/avatar.png'
        },
        action: 'REJECT',
        resourceType: 'SPACE',
        resourceName: 'Product Development',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        status: 'rejected'
      },
      {
        id: '6',
        user: {
          firstName: 'Emily',
          lastName: 'Davis',
          avatar: '/images/avatar.png'
        },
        action: 'DELETE',
        resourceType: 'FILE',
        resourceName: 'Outdated Presentation',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        status: 'rejected'
      },
      {
        id: '7',
        user: {
          firstName: 'Alex',
          lastName: 'Wilson',
          avatar: '/images/avatar.png'
        },
        action: 'REASSIGN',
        resourceType: 'CABINET',
        resourceName: 'Legal Documents',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
        status: 'pending'
      }
    ];

    return NextResponse.json(mockActivities);
  } catch (error) {
    console.error('Error in activities/recent API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activities' },
      { status: 500 }
    );
  }
}

// Helper function to determine status from action
function getStatusFromAction(action: string): string {
  switch (action) {
    case 'CREATE':
    case 'UPDATE':
    case 'APPROVE':
      return 'completed';
    case 'SUBMIT':
    case 'RESUBMIT':
    case 'REASSIGN':
      return 'pending';
    case 'REJECT':
    case 'DELETE':
      return 'rejected';
    default:
      return 'default';
  }
}
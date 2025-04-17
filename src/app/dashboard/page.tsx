'use client';
import React , { useState, useEffect } from 'react';
import DashboardPaperCut from '@/components/DashboardPaperCut';
import UploadAndSignPdf from '@/components/UploadFilesPaperCut';
import ApprovalsPaperCut from '@/components/ApprovalsPaperCut';
import { getCurrentUser, User } from '@/utils/api';

const PaperCutHomeLayout = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };

    fetchCurrentUser();
  }, []);
  return (    
        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">
            Hello, {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User'}
          </h2>
          <DashboardPaperCut />
          <UploadAndSignPdf />
          <div className="flex mt-6 gap-4">
            <ApprovalsPaperCut className="flex-1" />
          </div>
        </div>      
  );
};

export default PaperCutHomeLayout;

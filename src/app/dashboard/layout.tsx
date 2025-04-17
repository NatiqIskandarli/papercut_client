
import React, { Suspense, lazy } from 'react';
const Sidebar = lazy(() => import('@/components/Sidebar'));
const NavigationBar = lazy(() => import('@/components/NavigationBar'));
const Container = lazy(() => import('@/components/Container'));
import '../globals.css';



export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    
        <div className="flex h-screen">
          <Sidebar />          
          <Container className="flex-1 flex flex-col bg-gray-50">
          <Suspense fallback={<div>Loading Navigation...</div>}>
            <NavigationBar />
          </Suspense>
            {children}
          </Container>
        </div>
   
  );
}

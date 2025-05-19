'use client';
import React, { useState, useEffect, Suspense, lazy, memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from 'antd';
import { DoubleRightOutlined, DoubleLeftOutlined, DownOutlined, RightOutlined, StarOutlined, CompassOutlined,HomeOutlined, InboxOutlined, TeamOutlined, SettingOutlined, 
  SearchOutlined, UserAddOutlined, FolderOutlined, ImportOutlined,
  PlusCircleOutlined, EditOutlined, MailOutlined, FolderOpenOutlined, ShareAltOutlined } from '@ant-design/icons';

import '@/styles/Sidebar.css';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { API_URL } from '@/app/config';


const SidebarItem = memo(({ href, icon, label, collapsed }) => {
  const pathname = usePathname();
  return (
    <li className={pathname === href ? 'active' : ''}>
      <Link href={href}>
        {icon}
        <span className={collapsed ? 'hidden' : ''}> {label}</span>
      </Link>
    </li>
  );
});

SidebarItem.displayName = 'SidebarItem';


const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isFavoriteExpanded, setIsFavoriteExpanded] = useState(true);
  const [isNavigationExpanded, setIsNavigationExpanded] = useState(true);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(false);
  const [followedCabinets, setFollowedCabinets] = useState([]);


  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const toggleFavoriteSection = () => {
    setIsFavoriteExpanded(!isFavoriteExpanded);
  };

  const toggleNavigationSection = () => {
    setIsNavigationExpanded(!isNavigationExpanded);
  };

  const toggleTemplatesSection = () => {
    setIsTemplatesExpanded(!isTemplatesExpanded);
  };


  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ zIndex: 9999 }}>
        <div className="sidebar-header">
          <h2 className="sidebar-logo">
            {collapsed ? 'W' : <Image src="/images/logo.png" alt="Worsie Logo" width={100} height={100} />}
          </h2>
          <Button
            type="text"
            icon={collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
            onClick={toggleSidebar}
            className="toggle-button"
          />
        </div>
        
            <>
            <div className="sidebar-section">
              <ul>
                <li>
                  <Link href='/dashboard'>
                    <HomeOutlined />
                    <span className={collapsed ? 'hidden' : ''}> Home</span>
                  </Link>
                </li>
                
                <li>
                  <Link href='/dashboard/Inbox'>
                    <InboxOutlined />
                    <span className={collapsed ? 'hidden' : ''}> Inbox</span>
                  </Link>
                </li>
                <li>
                  <Link href='/dashboard/MyStaff'>
                    <TeamOutlined />
                    <span className={collapsed ? 'hidden' : ''}> My Staff</span>
                  </Link>
                </li>
                <li>
                  <Link href='/dashboard/Trash'>
                    <ImportOutlined />
                    <span className={collapsed ? 'hidden' : ''}> Trash / Deleted</span>
                  </Link>
                </li>
                <li>
                  <Link href='/dashboard/Signatures'>
                    <EditOutlined />
                    <span className={collapsed ? 'hidden' : ''}> Signatures</span>
                  </Link>
                </li>
                <li>
                  <Link href='/dashboard/Stamps'>
                    <CompassOutlined />
                    <span className={collapsed ? 'hidden' : ''}> Stamps</span>
                  </Link>
                </li>
                <li>
                  <Link href='/dashboard/UserManagement'>
                    <UserAddOutlined />
                    <span className={collapsed ? 'hidden' : ''}> User Management</span>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
                  <div 
                    className={`sidebar-title ${collapsed ? 'hidden' : ''}`} 
                    onClick={toggleTemplatesSection}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <FolderOutlined style={{ marginRight: '8px' }} />
                      <span>Templates</span>
                    </div>
                    {isTemplatesExpanded ? <DownOutlined /> : <RightOutlined />}
                  </div>
                  {isTemplatesExpanded && (
                    <ul>
                      <li>
                        <Link href='/dashboard/CreateForm'>
                          <EditOutlined />
                          <span className={collapsed ? 'hidden' : ''}> New Template</span>
                        </Link>
                      </li>
                      <li>
                        <Link href='/dashboard/CreateLetter'>
                          <MailOutlined />
                          <span className={collapsed ? 'hidden' : ''}> Use Template</span>
                        </Link>
                      </li>                 
                      <li>
                        <Link href='/dashboard/Templates/Created'>
                          <FolderOpenOutlined />
                          <span className={collapsed ? 'hidden' : ''}> My Templates</span>
                        </Link>
                      </li>
                      <li>
                        <Link href='/dashboard/Templates/Shared'>
                          <ShareAltOutlined />
                          <span className={collapsed ? 'hidden' : ''}> Shared with me</span>
                        </Link>
                      </li>
                      <li>
                        <Link href='/dashboard/Templates/Shared'>
                          <ShareAltOutlined />
                          <span className={collapsed ? 'hidden' : ''}> Shared by me</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                   </div>
            <div className="sidebar-section">
              <div 
                className={`active sidebar-title ${collapsed ? 'hidden' : ''}`} 
                onClick={toggleFavoriteSection}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <StarOutlined style={{ marginRight: '8px' }} />
                  <span>Favorite Templates</span>
                </div>
                {isFavoriteExpanded ? <DownOutlined /> : <RightOutlined />}
              </div>
              {isFavoriteExpanded && (
                <ul>
                  {followedCabinets.map((cabinet) => (
                    <li key={cabinet.id}>
                      <Link href={`/dashboard/Cabinet/${cabinet.id}`}>
                        <StarOutlined style={{ color: '#1890ff' }} />
                        <span className={collapsed ? 'hidden' : ''}> {cabinet.name}</span>
                      </Link>
                    </li>
                  ))}
                  {followedCabinets.length === 0 && (
                    <li className="no-favorites">
                      <span className={collapsed ? 'hidden' : ''}>No favorite cabinets yet</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="sidebar-footer">
              <Link href='/dashboard/Report' prefetch>
                <SettingOutlined />
                <span className={collapsed ? 'hidden' : ''}> Report</span>
              </Link>
            </div>
            </>

        </div>
    </Suspense>
  );
};

export default memo(Sidebar);

'use client';
import { Button, Input, Table, Tabs, Switch, Avatar, Space, Responsive } from 'antd';
import '@/styles/Table.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const { Search } = Input;

const MyTables = ({ columns, tableData }) =>{

    const router = useRouter();

    const [activeTab, setActiveTab] = useState("1");
    const [isActivityFeedVisible, setIsActivityFeedVisible] = useState(false);

    const onRecordClick = (recordId) => {
        router.push(`/dashboard/OpenRecord?id=${recordId}`);
    };

    const handleTabChange = (key) => {
      setActiveTab(key);
    };
  
    const handleToggleChange = (checked) => {
      setIsActivityFeedVisible(checked);
    };

    const tabItems = [
        { label: "Activity Feed", key: "1" },
        { label: "Comments", key: "2" },
    ];


    const updatedColumns = columns.map((col) => {
        if (col.dataIndex === 'recordName') {
          return {
            ...col,
            render: (text, record) => (
              <span
                onClick={() => onRecordClick(record.key)}
                style={{ cursor: 'pointer', color: '#1890ff' }}
              >
                {text}
              </span>
            ),
          };
        }
        return col;
      });


    return (
        <div className='marketingTeamFoot'>
            <div className="box tableBox">
                <div className="filtersFollowBar">
                    <Button>Filters</Button>
                    <Search placeholder="Search here" style={{ width: 200 }} />
                    <div className="toggleBar">
                        <span>Activity Feed</span>
                        <Switch
                        checked={isActivityFeedVisible}
                        onChange={handleToggleChange}
                        style={{ marginLeft: 10 }}
                        />
                    </div>
                    <Button className="followButton">Follow</Button>
                </div>
                <Table
                dataSource={tableData}
                columns={updatedColumns}
                pagination={{ pageSize: 5 }}
                className="recordTable"
                />
            </div>

           
            {isActivityFeedVisible && (
                <div className="box activityFeedBox">
                <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} className="records-tabs" />
                {activeTab === "1" && (
                    <div className="activityFeed">
                    <p>#1234 Siemens Grp Approved by Samsung Cabinet</p>
                    <p>#1234 Siemens Grp Approved by Samsung Cabinet</p>
                    </div>
                )}
                {activeTab === "2" && (
                    <div className="commentsFeed">
                    <p>No comments yet.</p>
                    </div>
                )}
                </div>
            )}

      </div>  
    );
}

export default MyTables;
import { Layout, Button, Input, Table, DatePicker, Card, Tabs, Avatar, Space, Responsive } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import styles from '../styles/table.module.css';

const columns = [
    {
      title: '',
      dataIndex: 'checkbox',
      key: 'checkbox',
      render: () => <input type="checkbox" />,
    },
    { title: 'Record Name', dataIndex: 'recordName', key: 'recordName'},
    {
      title: 'Status', dataIndex: 'status', key: 'status', render: (status) => (
        <span
          className={`${styles.statusTag} ${status === 'Reviewed' ? styles.reviewed : status === 'Done' ? styles.done : status === 'Left' ? styles.left : styles.notStarted}`}
        >
          {status}
        </span>
      ),
    },
    {
      title: 'Created by', dataIndex: 'createdBy', key: 'createdBy', render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar icon={<UserOutlined />} style={{ marginRight: '8px' }} src={`/images/avatar.png`} />
          {name}
        </div>
      )
    },
    {
      title: 'Record Creat',
      dataIndex: 'recordCreat',
      key: 'recordCreat',
      
    },
    {
      title: 'Priority', dataIndex: 'priority', key: 'priority', render: (priority) => (
        <span
          className={`${styles.priorityTag} ${priority === 'Medium' ? styles.medium : priority === 'High' ? styles.high : styles.low}`}
        >
          {priority}
        </span>
      )
    },
  ];


  const tableDatas = [
    { key: '1', recordName: 'CA Dry Gas Seals', status: 'Left', createdBy: 'Abdullah A', priority: 'Medium'},
    { key: '2', recordName: 'Add a new Task add a new task', status: 'Reviewed', createdBy: 'Abdullah A', priority: 'Low'},
    { key: '3', recordName: 'Add a new Task add a new task', status: 'Done', createdBy: 'Abdullah A', priority: 'Medium'},
    { key: '4', recordName: 'Add a new Task add a new task', status: 'Drafted', createdBy: 'Abdullah A', priority: 'High'},
  ]; 


export { columns, tableDatas };
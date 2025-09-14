import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Space, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  FormOutlined,
  UserOutlined,
  RobotOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Дашборд',
    },
    {
      key: '/forms',
      icon: <FormOutlined />,
      label: 'Формы',
    },
    {
      key: '/accounts',
      icon: <UserOutlined />,
      label: 'Аккаунты',
    },
    {
      key: '/automation',
      icon: <RobotOutlined />,
      label: 'Автоматизация',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <AntLayout className="layout">
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        className="sidebar"
        theme="dark"
      >
        <div className="logo">
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            {collapsed ? 'GFA' : 'Google Forms Automator'}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      
      <AntLayout>
        <Header className="header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="trigger"
            />
            <Title level={3} style={{ margin: 0, color: 'white' }}>
              Google Forms Automator
            </Title>
          </div>
          
          <div className="header-right">
            <Space>
              <Badge count={5} size="small">
                <Button 
                  type="text" 
                  icon={<BellOutlined />} 
                  style={{ color: 'white' }}
                />
              </Badge>
              <Button type="primary">
                Запустить
              </Button>
            </Space>
          </div>
        </Header>
        
        <Content className="content">
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;

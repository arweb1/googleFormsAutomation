import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  List, 
  Avatar, 
  Typography, 
  Button,
  Space,
  Alert
} from 'antd';
import {
  FormOutlined,
  UserOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalForms: 0,
    totalAccounts: 0,
    activeAutomations: 0,
    completedSubmissions: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Загрузка данных дашборда
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Здесь будет загрузка данных с сервера
    setStats({
      totalForms: 5,
      totalAccounts: 12,
      activeAutomations: 3,
      completedSubmissions: 247
    });

    setRecentActivity([
      {
        id: 1,
        type: 'success',
        message: 'Форма "Опрос клиентов" заполнена успешно',
        time: '2 минуты назад',
        icon: <CheckCircleOutlined />
      },
      {
        id: 2,
        type: 'info',
        message: 'Запущена автоматизация для формы "Регистрация"',
        time: '5 минут назад',
        icon: <RobotOutlined />
      },
      {
        id: 3,
        type: 'warning',
        message: 'Аккаунт user@example.com требует обновления cookies',
        time: '10 минут назад',
        icon: <ExclamationCircleOutlined />
      }
    ]);

    setChartData([
      { name: 'Пн', submissions: 45 },
      { name: 'Вт', submissions: 52 },
      { name: 'Ср', submissions: 38 },
      { name: 'Чт', submissions: 67 },
      { name: 'Пт', submissions: 89 },
      { name: 'Сб', submissions: 23 },
      { name: 'Вс', submissions: 12 }
    ]);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <Title level={2}>Дашборд</Title>
        <Text type="secondary">
          Обзор активности и статистика автоматизации форм
        </Text>
      </div>

      {/* Статистика */}
      <Row gutter={[16, 16]} className="stats-row">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Всего форм"
              value={stats.totalForms}
              prefix={<FormOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Аккаунтов"
              value={stats.totalAccounts}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Активных автоматизаций"
              value={stats.activeAutomations}
              prefix={<RobotOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Заполнено форм"
              value={stats.completedSubmissions}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="content-row">
        {/* График активности */}
        <Col xs={24} lg={16}>
          <Card title="Активность за неделю" extra={<Button type="link">Подробнее</Button>}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="submissions" 
                  stroke="#1890ff" 
                  strokeWidth={2}
                  dot={{ fill: '#1890ff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Прогресс автоматизаций */}
        <Col xs={24} lg={8}>
          <Card title="Текущие задачи">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Форма "Опрос клиентов"</Text>
                <Progress 
                  percent={75} 
                  status="active" 
                  size="small"
                  style={{ marginTop: 8 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  75 из 100 заполнений
                </Text>
              </div>
              
              <div>
                <Text strong>Форма "Регистрация"</Text>
                <Progress 
                  percent={45} 
                  status="active" 
                  size="small"
                  style={{ marginTop: 8 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  45 из 200 заполнений
                </Text>
              </div>
              
              <div>
                <Text strong>Форма "Обратная связь"</Text>
                <Progress 
                  percent={100} 
                  status="success" 
                  size="small"
                  style={{ marginTop: 8 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Завершено
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="content-row">
        {/* Последняя активность */}
        <Col xs={24} lg={12}>
          <Card title="Последняя активность" extra={<Button type="link">Все события</Button>}>
            <List
              dataSource={recentActivity}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={item.icon} style={{ backgroundColor: '#1890ff' }} />}
                    title={item.message}
                    description={item.time}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Быстрые действия */}
        <Col xs={24} lg={12}>
          <Card title="Быстрые действия">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" block icon={<FormOutlined />}>
                Добавить новую форму
              </Button>
              <Button block icon={<UserOutlined />}>
                Управление аккаунтами
              </Button>
              <Button block icon={<RobotOutlined />}>
                Запустить автоматизацию
              </Button>
              <Button block icon={<ClockCircleOutlined />}>
                Планировщик задач
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Уведомления */}
      <Alert
        message="Система работает стабильно"
        description="Все автоматизации выполняются согласно расписанию. Последняя проверка: 2 минуты назад."
        type="success"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  );
};

export default Dashboard;

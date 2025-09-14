import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Table,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Divider
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import ReactJson from 'react-json-view';
import './Forms.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Forms = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    setLoading(true);
    try {
      // Здесь будет загрузка форм с сервера
      const mockForms = [
        {
          id: '1',
          title: 'Опрос клиентов',
          url: 'https://forms.gle/example1',
          fields: 8,
          status: 'active',
          createdAt: '2024-01-15',
          submissions: 45
        },
        {
          id: '2',
          title: 'Регистрация на мероприятие',
          url: 'https://forms.gle/example2',
          fields: 12,
          status: 'active',
          createdAt: '2024-01-14',
          submissions: 23
        },
        {
          id: '3',
          title: 'Обратная связь',
          url: 'https://forms.gle/example3',
          fields: 5,
          status: 'paused',
          createdAt: '2024-01-13',
          submissions: 67
        }
      ];
      setForms(mockForms);
    } catch (error) {
      message.error('Ошибка при загрузке форм');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeForm = async (values) => {
    try {
      setLoading(true);
      // Здесь будет запрос к API для анализа формы
      message.success('Форма успешно проанализирована!');
      setAnalyzeModalVisible(false);
      form.resetFields();
      loadForms();
    } catch (error) {
      message.error('Ошибка при анализе формы');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForm = async (id) => {
    try {
      // Здесь будет запрос к API для удаления формы
      setForms(forms.filter(form => form.id !== id));
      message.success('Форма удалена');
    } catch (error) {
      message.error('Ошибка при удалении формы');
    }
  };

  const handleGenerateTemplate = async (formId) => {
    try {
      // Здесь будет запрос к API для генерации шаблона
      message.success('Шаблон данных создан');
    } catch (error) {
      message.error('Ошибка при создании шаблона');
    }
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.url}
          </Text>
        </div>
      ),
    },
    {
      title: 'Поля',
      dataIndex: 'fields',
      key: 'fields',
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'orange'}>
          {status === 'active' ? 'Активна' : 'Приостановлена'}
        </Tag>
      ),
    },
    {
      title: 'Заполнений',
      dataIndex: 'submissions',
      key: 'submissions',
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: 'Создана',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedForm(record);
              setModalVisible(true);
            }}
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleGenerateTemplate(record.id)}
          />
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => message.info('Запуск автоматизации')}
          />
          <Popconfirm
            title="Удалить форму?"
            onConfirm={() => handleDeleteForm(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="forms-page">
      <div className="page-header">
        <Title level={2}>Управление формами</Title>
        <Text type="secondary">
          Анализ и настройка Google Forms для автоматического заполнения
        </Text>
      </div>

      <Card className="actions-card">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Поиск форм..."
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Фильтр по статусу"
              style={{ width: '100%' }}
              allowClear
            >
              <Select.Option value="active">Активные</Select.Option>
              <Select.Option value="paused">Приостановленные</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAnalyzeModalVisible(true)}
              >
                Анализировать форму
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={forms}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Всего ${total} форм`,
          }}
        />
      </Card>

      {/* Модальное окно анализа формы */}
      <Modal
        title="Анализ Google Form"
        open={analyzeModalVisible}
        onCancel={() => setAnalyzeModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAnalyzeForm}
        >
          <Form.Item
            name="url"
            label="URL формы"
            rules={[
              { required: true, message: 'Введите URL формы' },
              { type: 'url', message: 'Введите корректный URL' }
            ]}
          >
            <Input placeholder="https://forms.gle/..." />
          </Form.Item>

          <Form.Item
            name="title"
            label="Название формы"
            rules={[{ required: true, message: 'Введите название формы' }]}
          >
            <Input placeholder="Опрос клиентов" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Описание"
          >
            <TextArea rows={3} placeholder="Краткое описание формы..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Анализировать
              </Button>
              <Button onClick={() => setAnalyzeModalVisible(false)}>
                Отмена
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно просмотра формы */}
      <Modal
        title={`Детали формы: ${selectedForm?.title}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedForm && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong>URL:</Text>
                <br />
                <Text copyable>{selectedForm.url}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Статус:</Text>
                <br />
                <Tag color={selectedForm.status === 'active' ? 'green' : 'orange'}>
                  {selectedForm.status === 'active' ? 'Активна' : 'Приостановлена'}
                </Tag>
              </Col>
            </Row>
            
            <Divider />
            
            <Text strong>Конфигурация полей:</Text>
            <div style={{ marginTop: 16, maxHeight: 400, overflow: 'auto' }}>
              <ReactJson
                src={{
                  fields: [
                    { type: 'text', name: 'name', label: 'Имя', required: true },
                    { type: 'email', name: 'email', label: 'Email', required: true },
                    { type: 'textarea', name: 'message', label: 'Сообщение', required: false }
                  ]
                }}
                theme="monokai"
                displayDataTypes={false}
                displayObjectSize={false}
                collapsed={false}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Forms;

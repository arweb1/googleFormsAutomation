import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Forms from './pages/Forms/Forms';
import Accounts from './pages/Accounts/Accounts';
import Automation from './pages/Automation/Automation';
import Settings from './pages/Settings/Settings';
import './App.css';

function App() {
  return (
    <ConfigProvider locale={ruRU}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forms" element={<Forms />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;

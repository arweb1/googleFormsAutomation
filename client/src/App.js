import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Forms from './pages/Forms';
import Accounts from './pages/Accounts';
import Automation from './pages/Automation';
import Results from './pages/Results';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/forms" element={<Forms />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/results" element={<Results />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
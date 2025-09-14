import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as FormsIcon,
  People as AccountsIcon,
  PlayArrow as AutomationIcon,
  Assessment as ResultsIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const menuItems = [
    { path: '/', label: 'Главная', icon: <DashboardIcon /> },
    { path: '/forms', label: 'Формы', icon: <FormsIcon /> },
    { path: '/accounts', label: 'Аккаунты', icon: <AccountsIcon /> },
    { path: '/automation', label: 'Автоматизация', icon: <AutomationIcon /> },
    { path: '/results', label: 'Результаты', icon: <ResultsIcon /> }
  ];

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Google Forms Automator
        </Typography>
        
        {/* Desktop Navigation */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          {menuItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{
                backgroundColor: location.pathname === item.path ? 'rgba(255,255,255,0.1)' : 'transparent'
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {/* Mobile Navigation */}
        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={handleMenuOpen}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            {menuItems.map((item) => (
              <MenuItem
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  handleMenuClose();
                }}
                selected={location.pathname === item.path}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {item.icon}
                  {item.label}
                </Box>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;

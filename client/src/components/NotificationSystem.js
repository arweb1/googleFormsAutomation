import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const NotificationSystem = () => {
  const [currentNotification, setCurrentNotification] = useState(null);
  const [shownNotifications, setShownNotifications] = useState(new Set());

  const showNotification = (notification) => {
    console.log('showNotification вызвана с:', notification);
    setCurrentNotification(notification);
    
    // Добавляем ID уведомления в список показанных
    setShownNotifications(prev => new Set([...prev, notification.id]));
    
    // Воспроизводим звук уведомления
    if (notification.sound) {
      console.log('Воспроизводим звук уведомления');
      playNotificationSound();
    }
    
    // Автоматически скрываем уведомление через 5 секунд
    setTimeout(() => {
      console.log('Автоматически скрываем уведомление');
      setCurrentNotification(null);
    }, 5000);
  };

  useEffect(() => {
    // Слушаем события от WebSocket или polling
    const checkForNotifications = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/notifications');
        if (response.ok) {
          const data = await response.json();
          console.log('Получены уведомления:', data);
          if (data.notifications && data.notifications.length > 0) {
            // Показываем только новые уведомления, которые еще не показывались
            const newNotifications = data.notifications.filter(
              notification => !shownNotifications.has(notification.id)
            );
            
            console.log('Новые уведомления:', newNotifications);
            newNotifications.forEach(notification => {
              console.log('Показываем уведомление:', notification);
              showNotification(notification);
            });
          }
        } else {
          console.error('Ошибка ответа сервера:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Ошибка при получении уведомлений:', error);
      }
    };

    // Проверяем уведомления каждые 5 секунд (увеличили интервал)
    const interval = setInterval(checkForNotifications, 5000);
    
    return () => clearInterval(interval);
  }, [shownNotifications]);

  const playNotificationSound = () => {
    try {
      // Создаем приятный звук уведомления
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Создаем мелодию уведомления
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      const duration = 0.2;
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + duration + index * 0.1);
      });
    } catch (error) {
      console.error('Ошибка при воспроизведении звука:', error);
    }
  };

  const handleClose = () => {
    setCurrentNotification(null);
  };

  const getSeverity = (type) => {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  return (
    <Snackbar
      open={!!currentNotification}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ mt: 8 }}
    >
      <Alert
        onClose={handleClose}
        severity={getSeverity(currentNotification?.type)}
        variant="filled"
        sx={{ 
          minWidth: 300,
          '& .MuiAlert-message': {
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }
        }}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        <span style={{ fontSize: '1.2em', marginRight: '8px' }}>
          {getIcon(currentNotification?.type)}
        </span>
        {currentNotification?.message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSystem;

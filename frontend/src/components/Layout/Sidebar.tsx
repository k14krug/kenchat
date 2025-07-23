import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Typography,
  Chip,
} from '@mui/material';
import {
  Chat as ChatIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { createConversation } from '../../store/slices/conversationSlice';

interface SidebarProps {
  onItemClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  const { conversations, isLoading } = useAppSelector((state) => state.conversation);

  const menuItems = [
    { text: 'Chat', icon: <ChatIcon />, path: '/chat' },
    { text: 'Conversations', icon: <HistoryIcon />, path: '/conversations' },
    { text: 'Personas', icon: <PersonIcon />, path: '/personas' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    onItemClick?.();
  };

  const handleNewConversation = async () => {
    try {
      const result = await dispatch(createConversation({})).unwrap();
      navigate(`/chat/${result.id}`);
      onItemClick?.();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    navigate(`/chat/${conversationId}`);
    onItemClick?.();
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar />
      
      {/* New Conversation Button */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={handleNewConversation}
          disabled={isLoading}
          sx={{
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.light',
              color: 'primary.contrastText',
            },
          }}
        >
          <ListItemIcon>
            <AddIcon />
          </ListItemIcon>
          <ListItemText primary="New Conversation" />
        </ListItemButton>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Recent Conversations */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
          Recent Conversations
        </Typography>
        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {conversations.slice(0, 10).map((conversation) => (
            <ListItem key={conversation.id} disablePadding>
              <ListItemButton
                selected={location.pathname === `/chat/${conversation.id}`}
                onClick={() => handleConversationClick(conversation.id)}
                sx={{ pl: 3 }}
              >
                <ListItemText
                  primary={conversation.title || 'Untitled Conversation'}
                  secondary={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </Typography>
                      {conversation.intent && (
                        <Chip 
                          label={conversation.intent} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                          sx={{ fontSize: '0.6rem', height: 16 }}
                        />
                      )}
                    </Box>
                  }
                  primaryTypographyProps={{
                    noWrap: true,
                    fontSize: '0.875rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default Sidebar;
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Card,
  CardContent,
  Fab,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SmartToy as BotIcon,
  AccountCircle as UserIcon,
  Edit as EditIcon,
  Psychology as IntentIcon,
} from '@mui/icons-material';
import PersonaSelector from '../components/UI/PersonaSelector';
import IntentSelector from '../components/UI/IntentSelector';
import StatusIndicator from '../components/UI/StatusIndicator';
import ModelSelector from '../components/UI/ModelSelector';
import CostDisplay from '../components/UI/CostDisplay';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchConversation,
  sendMessage,
  sendChatMessage,
  updateConversation,
  createConversation,
  setCurrentConversation,
  addMessage,
} from '../store/slices/conversationSlice';
import { fetchPersonas, setCurrentPersona } from '../store/slices/personaSlice';
import { setTyping, addNotification } from '../store/slices/uiSlice';
import { Message } from '../store/slices/conversationSlice';
import { useStreamingChat } from '../hooks/useStreamingChat';

const ChatPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { currentConversation, messages, isSending, isLoadingMessages } = useAppSelector(
    (state) => state.conversation
  );
  const { personas, currentPersona } = useAppSelector((state) => state.persona);
  const { isTyping } = useAppSelector((state) => state.ui);

  // Streaming chat hook
  const streamingChat = useStreamingChat({
    onUserMessage: (message) => {
      dispatch(addMessage(message));
    },
    onContentChunk: (chunk, accumulated) => {
      setStreamingContent(accumulated);
    },
    onAssistantMessage: (message, aiResponse) => {
      dispatch(addMessage(message));
      setStreamingContent('');
      setIsStreamingActive(false);
    },
    onError: (error) => {
      dispatch(addNotification({
        type: 'error',
        message: `Failed to generate response: ${error.message}`,
      }));
      setIsStreamingActive(false);
      setStreamingContent('');
    },
    onComplete: () => {
      setIsStreamingActive(false);
      setStreamingContent('');
    },
    onStatusUpdate: (status) => {
      // Could show status in UI if needed
    },
  });
  
  const [messageInput, setMessageInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customInstructionsDialogOpen, setCustomInstructionsDialogOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [useStreaming, setUseStreaming] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreamingActive, setIsStreamingActive] = useState(false);

  // Initialize conversation and personas
  useEffect(() => {
    dispatch(fetchPersonas());
    
    if (conversationId) {
      dispatch(fetchConversation(conversationId));
    } else {
      // Create new conversation if no ID provided
      dispatch(createConversation({})).then((result) => {
        if (result.meta.requestStatus === 'fulfilled') {
          const conversation = result.payload as any;
          navigate(`/chat/${conversation.id}`, { replace: true });
        }
      });
    }
  }, [conversationId, dispatch, navigate]);

  // Set current conversation data in local state
  useEffect(() => {
    if (currentConversation) {
      setCustomInstructions(currentConversation.customInstructions || '');
      
      // Set current persona if specified in conversation
      if (currentConversation.currentPersonaId) {
        const persona = personas.find(p => p.id === currentConversation.currentPersonaId);
        if (persona) {
          dispatch(setCurrentPersona(persona));
        }
      }
    }
  }, [currentConversation, personas, dispatch]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !conversationId || isSending || isStreamingActive) return;

    const content = messageInput.trim();
    setMessageInput('');

    try {
      if (useStreaming) {
        setIsStreamingActive(true);
        dispatch(setTyping(true));
        
        await streamingChat.sendStreamingMessage({
          conversationId,
          content,
          personaId: currentPersona?.id,
          model: selectedModel,
          options: {
            temperature: 0.7,
            maxTokens: 2000,
          },
        });
      } else {
        dispatch(setTyping(true));
        await dispatch(sendChatMessage({
          conversationId,
          content,
          personaId: currentPersona?.id,
          model: selectedModel,
          options: {
            temperature: 0.7,
            maxTokens: 2000,
          },
        })).unwrap();
      }
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to send message. Please try again.',
      }));
      setMessageInput(content); // Restore message on error
      setIsStreamingActive(false);
      setStreamingContent('');
    } finally {
      dispatch(setTyping(false));
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handlePersonaChange = (persona: any) => {
    if (conversationId) {
      dispatch(updateConversation({
        conversationId,
        updates: { currentPersonaId: persona.id }
      }));
    }
  };

  const handleIntentChange = async (intent: string) => {
    if (conversationId) {
      await dispatch(updateConversation({
        conversationId,
        updates: { intent }
      }));
    }
  };

  const handleCustomInstructionsSave = async () => {
    if (conversationId) {
      await dispatch(updateConversation({
        conversationId,
        updates: { customInstructions }
      }));
    }
    setCustomInstructionsDialogOpen(false);
  };

  const getPersonaName = (personaId?: string) => {
    if (!personaId) return 'Default';
    const persona = personas.find(p => p.id === personaId);
    return persona?.name || 'Unknown';
  };



  if (isLoadingMessages) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <Paper sx={{ p: 2, borderRadius: 0 }} elevation={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">
              {currentConversation?.title || 'New Conversation'}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <IntentSelector
                currentIntent={currentConversation?.intent}
                onIntentChange={handleIntentChange}
                variant="chip"
                size="small"
              />
              
              <PersonaSelector
                onPersonaChange={handlePersonaChange}
                variant="chip"
                size="small"
              />

              <ModelSelector
                currentModel={selectedModel}
                onModelChange={setSelectedModel}
                variant="chip"
                size="small"
              />

              <CostDisplay
                conversationId={conversationId}
                variant="chip"
                size="small"
                showDetails={true}
              />
              
              <StatusIndicator
                connectionStatus={connectionStatus}
                size="small"
              />
            </Box>
          </Box>
          
          <IconButton onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        {/* Expandable Settings */}
        <Collapse in={showSettings}>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setCustomInstructionsDialogOpen(true)}
              variant="outlined"
            >
              Custom Instructions
            </Button>
          </Box>
          
          {currentConversation?.customInstructions && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Custom Instructions:</strong> {currentConversation.customInstructions}
              </Typography>
            </Alert>
          )}
        </Collapse>
      </Paper>

      {/* Messages Area */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.length === 0 ? (
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2
          }}>
            <BotIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
            <Typography variant="h6" color="text.secondary" align="center">
              Start a conversation with {currentPersona?.name || 'your AI assistant'}
            </Typography>
            {currentPersona?.description && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
                {currentPersona.description}
              </Typography>
            )}
          </Box>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              personaName={getPersonaName(message.personaId)}
            />
          ))
        )}
        
        {/* Streaming Content Display */}
        {isStreamingActive && streamingContent && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              <BotIcon fontSize="small" />
            </Avatar>
            <Box sx={{ maxWidth: '70%' }}>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  borderBottomLeftRadius: 4,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                  {getPersonaName(currentPersona?.id)} (typing...)
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {streamingContent}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: '2px',
                      height: '1em',
                      bgcolor: 'primary.main',
                      ml: 0.5,
                      animation: 'blink 1s infinite',
                    }}
                  />
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}

        {/* Typing Indicator */}
        {(isSending || isTyping) && !isStreamingActive && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              <BotIcon fontSize="small" />
            </Avatar>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: 'text.secondary',
                  animation: 'pulse 1.4s ease-in-out infinite'
                }} />
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: 'text.secondary',
                  animation: 'pulse 1.4s ease-in-out 0.2s infinite'
                }} />
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: 'text.secondary',
                  animation: 'pulse 1.4s ease-in-out 0.4s infinite'
                }} />
              </Box>
            </Paper>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Paper sx={{ p: 2, borderRadius: 0 }} elevation={3}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Type your message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            variant="outlined"
            size="small"
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending || isStreamingActive}
            sx={{ mb: 0.5 }}
          >
            {(isSending || isStreamingActive) ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>



      {/* Custom Instructions Dialog */}
      <Dialog 
        open={customInstructionsDialogOpen} 
        onClose={() => setCustomInstructionsDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Custom Instructions</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Custom Instructions"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Tell the AI how you'd like it to interact with you, your preferences, background, or any specific instructions..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomInstructionsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCustomInstructionsSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper function for formatting message time
const formatMessageTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  personaName: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, personaName }) => {
  const isUser = message.role === 'user';
  
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start',
      gap: 1
    }}>
      {!isUser && (
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
          <BotIcon fontSize="small" />
        </Avatar>
      )}
      
      <Box sx={{ maxWidth: '70%' }}>
        <Paper
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            ...(isUser && {
              borderBottomRightRadius: 4,
            }),
            ...(!isUser && {
              borderBottomLeftRadius: 4,
            }),
          }}
        >
          {!isUser && (
            <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
              {personaName}
            </Typography>
          )}
          
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mt: 1,
            gap: 1
          }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {formatMessageTime(message.createdAt)}
            </Typography>
            
            {message.cost && (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                ${message.cost.toFixed(4)}
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>
      
      {isUser && (
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
          <UserIcon fontSize="small" />
        </Avatar>
      )}
    </Box>
  );
};

export default ChatPage;
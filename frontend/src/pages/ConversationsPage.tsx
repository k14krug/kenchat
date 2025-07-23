import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
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
  Grid,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Fab,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  Add as AddIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
  AttachMoney as CostIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchConversations,
  deleteConversation,
  updateConversation,
  createConversation,
} from '../store/slices/conversationSlice';
import { fetchPersonas } from '../store/slices/personaSlice';
import { Conversation } from '../store/slices/conversationSlice';

const ConversationsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { conversations, isLoading } = useAppSelector((state) => state.conversation);
  const { personas } = useAppSelector((state) => state.persona);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIntent, setFilterIntent] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    dispatch(fetchConversations());
    dispatch(fetchPersonas());
  }, [dispatch]);

  // Filter and sort conversations
  const filteredConversations = conversations
    .filter((conv) => {
      const matchesSearch = !searchTerm || 
        conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.intent?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesIntent = !filterIntent || conv.intent === filterIntent;
      return matchesSearch && matchesIntent;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'title':
          return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
        default:
          return 0;
      }
    });

  const uniqueIntents = Array.from(new Set(conversations.map(c => c.intent).filter(Boolean)));

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, conversation: Conversation) => {
    setAnchorEl(event.currentTarget);
    setSelectedConversation(conversation);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedConversation(null);
  };

  const handleEdit = () => {
    if (selectedConversation) {
      setEditTitle(selectedConversation.title || '');
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleArchive = async () => {
    if (selectedConversation) {
      await dispatch(updateConversation({
        conversationId: selectedConversation.id,
        updates: { isArchived: !selectedConversation.isArchived }
      }));
    }
    handleMenuClose();
  };

  const confirmDelete = async () => {
    if (selectedConversation) {
      await dispatch(deleteConversation(selectedConversation.id));
    }
    setDeleteDialogOpen(false);
    setSelectedConversation(null);
  };

  const saveEdit = async () => {
    if (selectedConversation) {
      await dispatch(updateConversation({
        conversationId: selectedConversation.id,
        updates: { title: editTitle }
      }));
    }
    setEditDialogOpen(false);
    setSelectedConversation(null);
  };

  const handleNewConversation = async () => {
    try {
      const result = await dispatch(createConversation({})).unwrap();
      navigate(`/chat/${result.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const getPersonaName = (personaId?: string) => {
    if (!personaId) return 'Default';
    const persona = personas.find(p => p.id === personaId);
    return persona?.name || 'Unknown';
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Conversations
        </Typography>
        
        {/* Search and Filters */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Filter by Intent</InputLabel>
              <Select
                value={filterIntent}
                label="Filter by Intent"
                onChange={(e) => setFilterIntent(e.target.value)}
              >
                <MenuItem value="">All Intents</MenuItem>
                {uniqueIntents.map((intent) => (
                  <MenuItem key={intent} value={intent}>
                    {intent}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <MenuItem value="updated">Last Updated</MenuItem>
                <MenuItem value="created">Date Created</MenuItem>
                <MenuItem value="title">Title</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Conversations List */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {filteredConversations.length === 0 ? (
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2
          }}>
            <ChatIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
            <Typography variant="h6" color="text.secondary">
              {conversations.length === 0 ? 'No conversations yet' : 'No conversations match your search'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewConversation}
            >
              Start New Conversation
            </Button>
          </Box>
        ) : (
          <List sx={{ flexGrow: 1, overflow: 'auto' }}>
            {filteredConversations.map((conversation) => (
              <ListItem key={conversation.id} divider>
                <Card sx={{ width: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {conversation.title || 'Untitled Conversation'}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                          {conversation.intent && (
                            <Chip 
                              label={conversation.intent} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          )}
                          {conversation.currentPersonaId && (
                            <Chip 
                              icon={<PersonIcon />}
                              label={getPersonaName(conversation.currentPersonaId)} 
                              size="small" 
                              color="secondary" 
                              variant="outlined"
                            />
                          )}
                          {conversation.totalCost > 0 && (
                            <Chip 
                              icon={<CostIcon />}
                              label={`$${conversation.totalCost.toFixed(4)}`} 
                              size="small" 
                              color="info" 
                              variant="outlined"
                            />
                          )}
                          {conversation.isArchived && (
                            <Chip 
                              label="Archived" 
                              size="small" 
                              color="default" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary">
                          Created: {new Date(conversation.createdAt).toLocaleDateString()}
                          {' • '}
                          Updated: {new Date(conversation.updatedAt).toLocaleDateString()}
                        </Typography>
                        
                        {conversation.customInstructions && (
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            "{conversation.customInstructions.substring(0, 100)}..."
                          </Typography>
                        )}
                      </Box>
                      
                      <IconButton
                        onClick={(e) => handleMenuClick(e, conversation)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<ChatIcon />}
                      onClick={() => navigate(`/chat/${conversation.id}`)}
                    >
                      Open Chat
                    </Button>
                  </CardActions>
                </Card>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="new conversation"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleNewConversation}
      >
        <AddIcon />
      </Fab>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Title
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <ArchiveIcon sx={{ mr: 1 }} />
          {selectedConversation?.isArchived ? 'Unarchive' : 'Archive'}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Conversation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedConversation?.title || 'this conversation'}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Title Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Conversation Title</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConversationsPage;
import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Chip,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Person as PersonIcon,
  Add as AddIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCurrentPersona, createPersona } from '../../store/slices/personaSlice';
import { Persona } from '../../store/slices/personaSlice';

interface PersonaSelectorProps {
  onPersonaChange?: (persona: Persona) => void;
  showCreateOption?: boolean;
  variant?: 'button' | 'chip';
  size?: 'small' | 'medium';
}

const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  onPersonaChange,
  showCreateOption = false,
  variant = 'chip',
  size = 'medium'
}) => {
  const dispatch = useAppDispatch();
  const { personas, currentPersona, isLoading } = useAppSelector((state) => state.persona);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaDescription, setNewPersonaDescription] = useState('');
  const [newPersonaPrompt, setNewPersonaPrompt] = useState('');

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePersonaSelect = (persona: Persona) => {
    dispatch(setCurrentPersona(persona));
    onPersonaChange?.(persona);
    handleClose();
  };

  const handleCreatePersona = async () => {
    if (!newPersonaName.trim() || !newPersonaPrompt.trim()) return;

    try {
      const result = await dispatch(createPersona({
        name: newPersonaName.trim(),
        description: newPersonaDescription.trim() || undefined,
        systemPrompt: newPersonaPrompt.trim(),
      })).unwrap();

      handlePersonaSelect(result);
      setCreateDialogOpen(false);
      setNewPersonaName('');
      setNewPersonaDescription('');
      setNewPersonaPrompt('');
    } catch (error) {
      console.error('Failed to create persona:', error);
    }
  };

  const renderTrigger = () => {
    if (variant === 'button') {
      return (
        <Button
          onClick={handleClick}
          startIcon={<PersonIcon />}
          endIcon={<ArrowDownIcon />}
          variant="outlined"
          size={size}
          disabled={isLoading}
        >
          {currentPersona?.name || 'Select Persona'}
        </Button>
      );
    }

    return (
      <Chip
        icon={<PersonIcon />}
        label={currentPersona?.name || 'Default'}
        onClick={handleClick}
        clickable
        size={size}
        color="secondary"
        variant="outlined"
        disabled={isLoading}
      />
    );
  };

  return (
    <>
      {renderTrigger()}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 280, maxWidth: 400 }
        }}
      >
        {personas.map((persona) => (
          <MenuItem
            key={persona.id}
            onClick={() => handlePersonaSelect(persona)}
            selected={persona.id === currentPersona?.id}
          >
            <ListItemIcon>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                <PersonIcon fontSize="small" />
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={persona.name}
              secondary={persona.description}
              secondaryTypographyProps={{
                noWrap: true,
                sx: { maxWidth: 200 }
              }}
            />
            {persona.isDefault && (
              <Chip label="Default" size="small" color="primary" />
            )}
          </MenuItem>
        ))}

        {showCreateOption && (
          <>
            <Divider />
            <MenuItem onClick={() => setCreateDialogOpen(true)}>
              <ListItemIcon>
                <AddIcon />
              </ListItemIcon>
              <ListItemText primary="Create New Persona" />
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Create Persona Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Persona</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Persona Name"
              value={newPersonaName}
              onChange={(e) => setNewPersonaName(e.target.value)}
              required
              fullWidth
            />
            
            <TextField
              label="Description (Optional)"
              value={newPersonaDescription}
              onChange={(e) => setNewPersonaDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            
            <TextField
              label="System Prompt"
              value={newPersonaPrompt}
              onChange={(e) => setNewPersonaPrompt(e.target.value)}
              required
              fullWidth
              multiline
              rows={4}
              placeholder="Define how this persona should behave, its expertise, personality traits, etc."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreatePersona}
            variant="contained"
            disabled={!newPersonaName.trim() || !newPersonaPrompt.trim() || isLoading}
          >
            Create Persona
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PersonaSelector;
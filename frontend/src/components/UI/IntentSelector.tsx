import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Psychology as IntentIcon,
  Add as AddIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Code as CodeIcon,
  Create as CreateIcon,
  QuestionAnswer as QuestionIcon,
  Lightbulb as IdeaIcon,
  School as LearnIcon,
  Work as WorkIcon,
} from '@mui/icons-material';

interface IntentSelectorProps {
  currentIntent?: string;
  onIntentChange: (intent: string) => void;
  variant?: 'button' | 'chip';
  size?: 'small' | 'medium';
}

const PREDEFINED_INTENTS = [
  { value: 'brainstorming', label: 'Brainstorming', icon: <IdeaIcon />, description: 'Generate and explore ideas' },
  { value: 'coding', label: 'Coding Help', icon: <CodeIcon />, description: 'Programming assistance and debugging' },
  { value: 'writing', label: 'Creative Writing', icon: <CreateIcon />, description: 'Stories, articles, and creative content' },
  { value: 'learning', label: 'Learning', icon: <LearnIcon />, description: 'Explanations and educational content' },
  { value: 'problem-solving', label: 'Problem Solving', icon: <QuestionIcon />, description: 'Analyze and solve problems' },
  { value: 'work', label: 'Work Tasks', icon: <WorkIcon />, description: 'Professional and business tasks' },
];

const IntentSelector: React.FC<IntentSelectorProps> = ({
  currentIntent,
  onIntentChange,
  variant = 'chip',
  size = 'medium'
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customIntent, setCustomIntent] = useState('');

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleIntentSelect = (intent: string) => {
    onIntentChange(intent);
    handleClose();
  };

  const handleCustomIntent = () => {
    if (customIntent.trim()) {
      onIntentChange(customIntent.trim());
      setCustomIntent('');
      setCustomDialogOpen(false);
      handleClose();
    }
  };

  const getCurrentIntentLabel = () => {
    const predefined = PREDEFINED_INTENTS.find(intent => intent.value === currentIntent);
    return predefined?.label || currentIntent || 'Set Intent';
  };

  const renderTrigger = () => {
    if (variant === 'button') {
      return (
        <Button
          onClick={handleClick}
          startIcon={<IntentIcon />}
          endIcon={<ArrowDownIcon />}
          variant="outlined"
          size={size}
        >
          {getCurrentIntentLabel()}
        </Button>
      );
    }

    return (
      <Chip
        icon={<IntentIcon />}
        label={getCurrentIntentLabel()}
        onClick={handleClick}
        clickable
        size={size}
        color={currentIntent ? 'primary' : 'default'}
        variant="outlined"
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
          sx: { minWidth: 300, maxWidth: 400 }
        }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" color="text.secondary">
            Choose conversation intent
          </Typography>
        </MenuItem>
        <Divider />

        {PREDEFINED_INTENTS.map((intent) => (
          <MenuItem
            key={intent.value}
            onClick={() => handleIntentSelect(intent.value)}
            selected={intent.value === currentIntent}
          >
            <ListItemIcon>
              {intent.icon}
            </ListItemIcon>
            <ListItemText
              primary={intent.label}
              secondary={intent.description}
            />
          </MenuItem>
        ))}

        <Divider />
        
        <MenuItem onClick={() => setCustomDialogOpen(true)}>
          <ListItemIcon>
            <AddIcon />
          </ListItemIcon>
          <ListItemText primary="Custom Intent" />
        </MenuItem>

        {currentIntent && (
          <MenuItem onClick={() => handleIntentSelect('')}>
            <ListItemText 
              primary="Clear Intent" 
              sx={{ color: 'text.secondary' }}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Custom Intent Dialog */}
      <Dialog
        open={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Set Custom Intent</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Custom Intent"
            fullWidth
            variant="outlined"
            value={customIntent}
            onChange={(e) => setCustomIntent(e.target.value)}
            placeholder="e.g., Recipe planning, Travel advice, etc."
            helperText="Describe what you want to accomplish in this conversation"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCustomIntent}
            variant="contained"
            disabled={!customIntent.trim()}
          >
            Set Intent
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IntentSelector;
import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Info as InfoIcon,
  Speed as SpeedIcon,
  AttachMoney as CostIcon,
  Memory as TokenIcon,
} from '@mui/icons-material';
import { chatAPI } from '../../services/api';

interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  capabilities: string[];
}

interface ModelSelectorProps {
  currentModel?: string;
  onModelChange: (modelId: string) => void;
  variant?: 'select' | 'chip';
  size?: 'small' | 'medium';
  disabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel = 'gpt-4o-mini',
  onModelChange,
  variant = 'select',
  size = 'medium',
  disabled = false,
}) => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [selectedModelInfo, setSelectedModelInfo] = useState<AIModel | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const modelsData = await chatAPI.getModels();
      setModels(modelsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load models:', err);
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    onModelChange(modelId);
  };

  const handleShowModelInfo = async (modelId: string) => {
    try {
      const modelInfo = await chatAPI.getModelInfo(modelId);
      setSelectedModelInfo(modelInfo);
      setInfoDialogOpen(true);
    } catch (err) {
      console.error('Failed to load model info:', err);
    }
  };

  const getCurrentModelName = () => {
    const model = models.find(m => m.id === currentModel);
    return model?.name || currentModel;
  };

  const getCurrentModel = () => {
    return models.find(m => m.id === currentModel);
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}/1K tokens`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Loading models...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
        <Button size="small" onClick={loadModels}>
          Retry
        </Button>
      </Box>
    );
  }

  if (variant === 'chip') {
    const currentModelData = getCurrentModel();
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={getCurrentModelName()}
          size={size}
          color="primary"
          variant="outlined"
          disabled={disabled}
          icon={<SpeedIcon />}
          onClick={() => !disabled && setInfoDialogOpen(true)}
          sx={{ cursor: disabled ? 'default' : 'pointer' }}
        />
        {currentModelData && (
          <Tooltip title={`Input: ${formatCost(currentModelData.inputCostPer1kTokens)} | Output: ${formatCost(currentModelData.outputCostPer1kTokens)}`}>
            <IconButton
              size="small"
              onClick={() => handleShowModelInfo(currentModel)}
              disabled={disabled}
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Model Info Dialog */}
        <Dialog
          open={infoDialogOpen}
          onClose={() => setInfoDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>AI Models</DialogTitle>
          <DialogContent>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Max Tokens</TableCell>
                    <TableCell align="right">Input Cost</TableCell>
                    <TableCell align="right">Output Cost</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((model) => (
                    <TableRow
                      key={model.id}
                      selected={model.id === currentModel}
                      sx={{ cursor: 'pointer' }}
                      hover
                      onClick={() => {
                        handleModelChange(model.id);
                        setInfoDialogOpen(false);
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {model.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {model.id}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {model.description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          <TokenIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {model.maxTokens.toLocaleString()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main">
                          {formatCost(model.inputCostPer1kTokens)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="warning.main">
                          {formatCost(model.outputCostPer1kTokens)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant={model.id === currentModel ? "contained" : "outlined"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleModelChange(model.id);
                            setInfoDialogOpen(false);
                          }}
                        >
                          {model.id === currentModel ? 'Current' : 'Select'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <FormControl size={size} disabled={disabled} sx={{ minWidth: 200 }}>
      <InputLabel>AI Model</InputLabel>
      <Select
        value={currentModel}
        label="AI Model"
        onChange={(e) => handleModelChange(e.target.value)}
      >
        {models.map((model) => (
          <MenuItem key={model.id} value={model.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Box>
                <Typography variant="body2">{model.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatCost(model.inputCostPer1kTokens)} / {formatCost(model.outputCostPer1kTokens)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowModelInfo(model.id);
                }}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ModelSelector;
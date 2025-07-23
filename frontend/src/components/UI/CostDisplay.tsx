import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  AttachMoney as CostIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { costAPI } from '../../services/api';

interface CostDisplayProps {
  conversationId?: string;
  currentCost?: number;
  variant?: 'chip' | 'detailed' | 'inline';
  size?: 'small' | 'medium';
  showDetails?: boolean;
}

interface CostSummary {
  totalCost: number;
  totalTokens: number;
  conversationCount: number;
  period: string;
  breakdown: Array<{
    date: string;
    cost: number;
    tokens: number;
    conversations: number;
  }>;
}

const CostDisplay: React.FC<CostDisplayProps> = ({
  conversationId,
  currentCost = 0,
  variant = 'chip',
  size = 'small',
  showDetails = false,
}) => {
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [conversationCost, setConversationCost] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (showDetails) {
      loadCostSummary();
    }
    if (conversationId) {
      loadConversationCost();
    }
  }, [conversationId, showDetails]);

  const loadCostSummary = async () => {
    try {
      setLoading(true);
      const summary = await costAPI.getUserCosts('day');
      setCostSummary(summary);
      setError(null);
    } catch (err) {
      console.error('Failed to load cost summary:', err);
      setError('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  const loadConversationCost = async () => {
    if (!conversationId) return;
    
    try {
      const cost = await costAPI.getConversationCost(conversationId);
      setConversationCost(cost);
    } catch (err) {
      console.error('Failed to load conversation cost:', err);
    }
  };

  const formatCost = (cost: number): string => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const getCostColor = (cost: number): 'default' | 'success' | 'warning' | 'error' => {
    if (cost === 0) return 'default';
    if (cost < 0.01) return 'success';
    if (cost < 0.10) return 'warning';
    return 'error';
  };

  const getCostWarningLevel = (cost: number): 'none' | 'low' | 'medium' | 'high' => {
    if (cost < 0.01) return 'none';
    if (cost < 0.05) return 'low';
    if (cost < 0.20) return 'medium';
    return 'high';
  };

  if (variant === 'inline') {
    return (
      <Typography variant="caption" color="text.secondary">
        {formatCost(currentCost)}
      </Typography>
    );
  }

  if (variant === 'chip') {
    const displayCost = conversationId ? conversationCost : currentCost;
    const warningLevel = getCostWarningLevel(displayCost);
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={<CostIcon />}
          label={formatCost(displayCost)}
          size={size}
          color={getCostColor(displayCost)}
          variant="outlined"
        />
        {warningLevel !== 'none' && (
          <Tooltip title={`Cost level: ${warningLevel}`}>
            <WarningIcon 
              fontSize="small" 
              color={warningLevel === 'high' ? 'error' : 'warning'} 
            />
          </Tooltip>
        )}
        {showDetails && (
          <IconButton size="small" onClick={() => setDetailsOpen(true)}>
            <InfoIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  }

  if (variant === 'detailed') {
    return (
      <Box>
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CostIcon />
                Cost Tracking
              </Typography>
              <Button
                size="small"
                onClick={() => setDetailsOpen(true)}
                startIcon={<TrendingUpIcon />}
              >
                View Details
              </Button>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Current Conversation
                </Typography>
                <Typography variant="h6">
                  {formatCost(conversationCost)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Today's Total
                </Typography>
                <Typography variant="h6">
                  {costSummary ? formatCost(costSummary.totalCost) : '--'}
                </Typography>
              </Grid>
            </Grid>

            {costSummary && costSummary.totalCost > 0.10 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Daily cost is getting high. Consider using a more cost-effective model.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <>
      {/* Cost Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Cost Details</DialogTitle>
        <DialogContent>
          {loading && <LinearProgress />}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {costSummary && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {formatCost(costSummary.totalCost)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Cost Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="secondary">
                      {costSummary.totalTokens.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Tokens Used
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6">
                      {costSummary.conversationCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Conversations Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {conversationId && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="success.main">
                        {formatCost(conversationCost)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Current Conversation Cost
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Cost Breakdown
                </Typography>
                {costSummary.breakdown.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: index < costSummary.breakdown.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2">
                      {new Date(item.date).toLocaleDateString()}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {item.tokens.toLocaleString()} tokens
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCost(item.cost)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CostDisplay;
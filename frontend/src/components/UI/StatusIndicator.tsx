import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import {
  Circle as CircleIcon,
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  Send as SendingIcon,
  Check as SentIcon,
  CheckCircle as Check,
  Error as ErrorIcon,
} from '@mui/icons-material';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export type MessageStatus = 'sending' | 'sent' | 'error' | 'delivered';

interface StatusIndicatorProps {
  connectionStatus?: ConnectionStatus;
  messageStatus?: MessageStatus;
  showText?: boolean;
  size?: 'small' | 'medium';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  connectionStatus,
  messageStatus,
  showText = false,
  size = 'small'
}) => {
  const getConnectionIcon = (): React.ReactElement | null => {
    switch (connectionStatus) {
      case 'connected':
        return <ConnectedIcon fontSize={size} color="success" />;
      case 'disconnected':
        return <DisconnectedIcon fontSize={size} color="error" />;
      case 'connecting':
        return <CircleIcon fontSize={size} color="warning" />;
      default:
        return null;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
      default:
        return '';
    }
  };

  const getConnectionColor = (): 'success' | 'error' | 'warning' | 'default' => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'disconnected':
        return 'error';
      case 'connecting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getMessageIcon = (): React.ReactElement | null => {
    switch (messageStatus) {
      case 'sending':
        return <SendingIcon fontSize={size} color="info" />;
      case 'sent':
        return <SentIcon fontSize={size} color="success" />;
      case 'error':
        return <ErrorIcon fontSize={size} color="error" />;
      case 'delivered':
        return <Check fontSize={size} color="success" />;
      default:
        return null;
    }
  };

  const getMessageText = () => {
    switch (messageStatus) {
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'error':
        return 'Failed';
      case 'delivered':
        return 'Delivered';
      default:
        return '';
    }
  };

  const getMessageColor = (): 'info' | 'success' | 'error' | 'default' => {
    switch (messageStatus) {
      case 'sending':
        return 'info';
      case 'sent':
      case 'delivered':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (connectionStatus && showText) {
    const icon = getConnectionIcon();
    return (
      <Chip
        icon={icon || undefined}
        label={getConnectionText()}
        size={size}
        color={getConnectionColor()}
        variant="outlined"
      />
    );
  }

  if (connectionStatus) {
    return (
      <Tooltip title={getConnectionText()}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
          {getConnectionIcon()}
        </Box>
      </Tooltip>
    );
  }

  if (messageStatus && showText) {
    const icon = getMessageIcon();
    return (
      <Chip
        icon={icon || undefined}
        label={getMessageText()}
        size={size}
        color={getMessageColor()}
        variant="outlined"
      />
    );
  }

  if (messageStatus) {
    return (
      <Tooltip title={getMessageText()}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
          {getMessageIcon()}
        </Box>
      </Tooltip>
    );
  }

  return null;
};

export default StatusIndicator;
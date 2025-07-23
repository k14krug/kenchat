import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const PersonasPage: React.FC = () => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Paper sx={{ flexGrow: 1, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h4" color="text.secondary">
          Personas Management Coming Soon
        </Typography>
      </Paper>
    </Box>
  );
};

export default PersonasPage;
import React, { useState, useEffect } from 'react';
import { Container, Typography, Grid, Card, CardContent, Box, Chip, Button } from '@mui/material';
import api from '../services/api';

export default function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [readiness, setReadiness] = useState(null);

  const fetchStatus = async () => {
    try {
      const resM = await api.get('/observability/metrics');
      setMetrics(resM.data);
      const resR = await api.get('/observability/health/readiness');
      setReadiness(resR.data);
    } catch (err) {
      console.error('Failed to fetch observability status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Enterprise Observability & Health Monitoring</Typography>
        <Button variant="outlined" onClick={fetchStatus}>Refresh Metrics</Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Database Readiness</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip label={readiness?.status || 'CHECKING'} color={readiness?.status === 'READY' ? 'success' : 'error'} />
                <Typography variant="body2">DB: {readiness?.dbConnection}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#f3e5f5' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Process Heap Memory</Typography>
              <Typography variant="h5">{metrics?.memory?.heapUsedMb || '0'} MB / {metrics?.memory?.heapTotalMb || '0'} MB</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#e8f5e9' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Server Uptime</Typography>
              <Typography variant="h5">{Math.floor((metrics?.uptimeSeconds || 0) / 60)} Minutes</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

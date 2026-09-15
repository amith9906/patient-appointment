import React, { useState, useEffect } from 'react';
import { Container, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Box, Chip } from '@mui/material';
import api from '../services/api';

export default function MDMManagement() {
  const [catalogs, setCatalogs] = useState([]);
  const [openPublish, setOpenPublish] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [version, setVersion] = useState('v1.1.0');
  const [jsonPayload, setJsonPayload] = useState('[\n  {"code": "ICD10-J00", "description": "Acute nasopharyngitis [common cold]"}\n]');

  const fetchCatalogs = async () => {
    try {
      const res = await api.get('/mdm/catalogs');
      setCatalogs(res.data || []);
    } catch (err) {
      console.error('Failed to load catalogs:', err);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const handlePublish = async () => {
    try {
      await api.post('/mdm/catalogs/publish', {
        catalogCode: selectedCatalog,
        version,
        dataPayload: JSON.parse(jsonPayload)
      });
      setOpenPublish(false);
      fetchCatalogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Publishing failed');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Master Data Management (MDM)</Typography>
        <Button variant="contained" color="primary" onClick={() => setOpenPublish(true)}>
          Publish Catalog Version
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Catalog Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Active Version</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {catalogs.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>{cat.catalogCode}</TableCell>
                <TableCell>{cat.catalogName}</TableCell>
                <TableCell><Chip label={cat.category} size="small" color="secondary" /></TableCell>
                <TableCell><Chip label={cat.activeVersion} size="small" color="success" /></TableCell>
                <TableCell>
                  <Button size="small" onClick={() => { setSelectedCatalog(cat.catalogCode); setOpenPublish(true); }}>
                    New Version
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={openPublish} onClose={() => setOpenPublish(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Publish New Catalog Version</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Catalog Code" value={selectedCatalog} onChange={(e) => setSelectedCatalog(e.target.value)} margin="normal" />
          <TextField fullWidth label="Version (e.g. v1.1.0)" value={version} onChange={(e) => setVersion(e.target.value)} margin="normal" />
          <TextField fullWidth multiline rows={6} label="JSON Data Payload" value={jsonPayload} onChange={(e) => setJsonPayload(e.target.value)} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPublish(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handlePublish}>Publish & Broadcast Sync</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

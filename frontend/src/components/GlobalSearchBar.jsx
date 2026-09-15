import React, { useState, useEffect } from 'react';
import { TextField, Autocomplete, Box, Typography, Chip, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import api from '../services/api';

export default function GlobalSearchBar({ onSelectResult }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search/global?q=${encodeURIComponent(query)}`);
        setOptions(res.data.results || []);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Box sx={{ width: 350 }}>
      <Autocomplete
        freeSolo
        options={options}
        loading={loading}
        getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.title || '')}
        onInputChange={(e, value) => setQuery(value)}
        onChange={(e, val) => onSelectResult && onSelectResult(val)}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id || option.entityId} sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{option.title}</Typography>
              <Typography variant="caption" color="text.secondary">{option.subtitle}</Typography>
            </Box>
            <Chip label={option.entity_type || option.entityType} size="small" color="primary" variant="outlined" />
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Search UHID, Patient, Doctor, Invoice (Ctrl+K)..."
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        )}
      />
    </Box>
  );
}

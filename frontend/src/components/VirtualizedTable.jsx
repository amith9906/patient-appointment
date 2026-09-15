import React, { useState } from 'react';
import { Box, Paper, Table, TableHead, TableRow, TableCell, TableBody, TablePagination } from '@mui/material';

/**
 * Virtualized / Paginated High-Performance Data Grid
 * Handles large datasets (100,000+ rows) smoothly without DOM lag.
 */
export default function VirtualizedTable({ columns = [], data = [], defaultRowsPerPage = 25 }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const visibleRows = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id || col.accessor} align={col.align || 'left'} sx={{ fontWeight: 'bold' }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row, idx) => (
              <TableRow hover key={row.id || idx}>
                {columns.map((col) => (
                  <TableCell key={col.id || col.accessor} align={col.align || 'left'}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Button
} from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import Refresh from '@mui/icons-material/Refresh';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { api } from '../lib/api';

function Row({ row }) {
  const [open, setOpen] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'FAILED': return 'error';
      case 'RUNNING': return 'primary';
      default: return 'default';
    }
  };

  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {new Date(row.started_at).toLocaleString()}
        </TableCell>
        <TableCell>{row.workflow_id}</TableCell>
        <TableCell>
          <Chip
            label={row.status}
            color={getStatusColor(row.status)}
            size="small"
          />
        </TableCell>
        <TableCell>
          {row.completed_at ?
            ((new Date(row.completed_at) - new Date(row.started_at)) / 1000).toFixed(2) + 's'
            : '-'}
        </TableCell>
        <TableCell>
          <Button
            variant="outlined"
            size="small"
            onClick={() => window.location.href = `/execution/${row.id}`}
          >
            View Details
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Execution Logs
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: 300, overflow: 'auto' }}>
                {row.execution_log && Array.isArray(row.execution_log) ? (
                  row.execution_log.map((log, index) => (
                    <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {log}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2">No logs available</Typography>
                )}
              </Paper>
              {row.error_message && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="error">
                    Error Details:
                  </Typography>
                  <Typography variant="body2" color="error">
                    {row.error_message}
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}

export default function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowId = searchParams.get('workflow_id');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let data;
      if (workflowId) {
        data = await api.workflows.getExecutions(workflowId);
      } else {
        data = await api.workflows.history();
      }
      setExecutions(data || []);
    } catch (error) {
      console.error("Failed to fetch history", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [workflowId]);

  const clearFilter = () => {
    setSearchParams({});
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {workflowId && (
            <IconButton onClick={clearFilter} title="Show all history">
              <ArrowBack />
            </IconButton>
          )}
          <Typography variant="h4">
            {workflowId ? `Execution History (Workflow #${workflowId})` : 'Execution History'}
          </Typography>
        </Box>
        <IconButton onClick={fetchHistory}>
          <Refresh />
        </IconButton>
      </Box>

      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Date</TableCell>
              <TableCell>Workflow ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : executions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body1" color="text.secondary">
                    No executions found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              executions.map((row) => (
                <Row key={row.id} row={row} />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import PlayIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import PhoneIcon from '@mui/icons-material/Phone';
import VisibilityIcon from '@mui/icons-material/DisabledVisible';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import VoiceTestInterface from '../../components/voice/VoiceTestInterface';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalCalls: number;
  completedCalls: number;
  successfulCalls: number;
  failedCalls: number;
  scriptTemplate: string;
}

interface Call {
  id: string;
  name: string;
  phone: string;
  status: string;
  disposition?: string;
  callDuration?: number;
  qualificationScore?: number;
  convertedToRawLead: boolean;
  createdAt: string;
  completedAt?: string;
}

interface Stats {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  pending: number;
  queued: number;
  calling: number;
  converted: number;
  avgDuration: number;
  avgScore: number;
}

const AIVoiceCampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCampaign();
      fetchCalls();
      fetchStats();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const response = await api.get(`/ai-voice-campaigns/${id}`);
      setCampaign(response.data);
    } catch (error) {
      console.error('Error fetching campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalls = async () => {
    try {
      const response = await api.get(`/ai-voice-campaigns/${id}/calls`);
      setCalls(response.data);
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get(`/ai-voice-campaigns/${id}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await api.post(`/ai-voice-campaigns/${id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      fetchCampaign();
      fetchCalls();
      fetchStats();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleStartCampaign = async () => {
    try {
      await api.post(`/ai-voice-campaigns/${id}/start`);
      fetchCampaign();
      fetchStats();
    } catch (error) {
      console.error('Error starting campaign:', error);
    }
  };

  const handlePauseCampaign = async () => {
    try {
      await api.post(`/ai-voice-campaigns/${id}/pause`);
      fetchCampaign();
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'default',
      QUEUED: 'info',
      CALLING: 'warning',
      COMPLETED: 'success',
      FAILED: 'error',
      NO_ANSWER: 'warning',
      BUSY: 'warning',
      WRONG_NUMBER: 'error',
    };
    return colors[status] || 'default';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !campaign) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('..')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">{campaign.name}</Typography>
        <Chip label={campaign.status} color={getStatusColor(campaign.status) as any} />
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3} component="div">
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Calls
                </Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3} component="div">
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Completed
                </Typography>
                <Typography variant="h4">{stats.completed}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3} component="div">
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Successful
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.successful}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.converted} converted to leads
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3} component="div">
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Avg Score
                </Typography>
                <Typography variant="h4">{Math.round(stats.avgScore)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg duration: {formatDuration(Math.round(stats.avgDuration))}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload Contacts
        </Button>

        {campaign.status === 'RUNNING' && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<PauseIcon />}
            onClick={handlePauseCampaign}
          >
            Pause Campaign
          </Button>
        )}

        {(campaign.status === 'PAUSED' || campaign.status === 'DRAFT') && campaign.totalCalls > 0 && (
          <Button
            variant="contained"
            color="success"
            startIcon={<PlayIcon />}
            onClick={handleStartCampaign}
          >
            Start Campaign
          </Button>
        )}

        <Button
          variant="outlined"
          color="secondary"
          startIcon={<PhoneIcon />}
          onClick={() => setIsTestOpen(true)}
        >
          Start Test Conversation
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_: React.SyntheticEvent, v: number) => setTabValue(v)}>
          <Tab label="Calls" />
          <Tab label="Script" />
        </Tabs>
      </Box>

      {/* Calls Table */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Disposition</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Converted</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>{call.name}</TableCell>
                  <TableCell>{call.phone}</TableCell>
                  <TableCell>
                    <Chip
                      label={call.status}
                      color={getStatusColor(call.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{call.disposition || '-'}</TableCell>
                  <TableCell>{formatDuration(call.callDuration)}</TableCell>
                  <TableCell>{call.qualificationScore || '-'}</TableCell>
                  <TableCell>
                    {call.convertedToRawLead ? (
                      <Chip label="Yes" color="success" size="small" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(call.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Script Tab */}
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Call Script
            </Typography>
            <Typography
              variant="body1"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                bgcolor: 'grey.100',
                p: 2,
                borderRadius: 1,
              }}
            >
              {campaign.scriptTemplate}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)}>
        <DialogTitle>Upload Contacts</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload an Excel file with columns: Name, Phone, Email (optional), City (optional), Address (optional)
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{ marginTop: 16 }}
          />
          {selectedFile && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Selected: {selectedFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <VoiceTestInterface
        open={isTestOpen}
        onClose={() => setIsTestOpen(false)}
        campaignId={id!}
        scriptTemplate={campaign.scriptTemplate}
      />
    </Box>
  );
};

export default AIVoiceCampaignDetailPage;

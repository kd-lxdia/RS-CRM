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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import UploadIcon from '@mui/icons-material/CloudUpload';
import PhoneIcon from '@mui/icons-material/Phone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/DisabledVisible';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  totalCalls: number;
  completedCalls: number;
  successfulCalls: number;
  failedCalls: number;
  createdAt: string;
  creator: {
    name: string;
  };
}

const AIVoiceCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    scriptTemplate: DEFAULT_SCRIPT,
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/ai-voice-campaigns');
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      await api.post('/ai-voice-campaigns', newCampaign);
      setCreateDialogOpen(false);
      setNewCampaign({
        name: '',
        description: '',
        scriptTemplate: DEFAULT_SCRIPT,
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const handleStartCampaign = async (id: string) => {
    try {
      await api.post(`/ai-voice-campaigns/${id}/start`);
      fetchCampaigns();
    } catch (error) {
      console.error('Error starting campaign:', error);
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      await api.post(`/ai-voice-campaigns/${id}/pause`);
      fetchCampaigns();
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'RUNNING':
        return 'success';
      case 'PAUSED':
        return 'warning';
      case 'COMPLETED':
        return 'info';
      default:
        return 'default';
    }
  };

  const getProgress = (campaign: Campaign) => {
    if (campaign.totalCalls === 0) return 0;
    return (campaign.completedCalls / campaign.totalCalls) * 100;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">AI Voice Campaigns</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Campaign
        </Button>
      </Box>

      <Grid container spacing={3}>
        {campaigns.map((campaign) => (
          <Grid item xs={12} md={6} lg={4} key={campaign.id} component="div">
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">{campaign.name}</Typography>
                  <Chip
                    label={campaign.status}
                    color={getStatusColor(campaign.status) as any}
                    size="small"
                  />
                </Box>

                {campaign.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {campaign.description}
                  </Typography>
                )}

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Progress</Typography>
                    <Typography variant="body2">
                      {campaign.completedCalls} / {campaign.totalCalls}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={getProgress(campaign)}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6} component="div">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                      <Typography variant="body2">
                        {campaign.successfulCalls} successful
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} component="div">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CancelIcon color="error" fontSize="small" />
                      <Typography variant="body2">
                        {campaign.failedCalls} failed
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => navigate(`${campaign.id}`)}
                    fullWidth
                  >
                    View
                  </Button>

                  {campaign.status === 'DRAFT' && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<UploadIcon />}
                      onClick={() => navigate(`${campaign.id}`)}
                      fullWidth
                    >
                      Upload
                    </Button>
                  )}

                  {campaign.status === 'RUNNING' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      startIcon={<PauseIcon />}
                      onClick={() => handlePauseCampaign(campaign.id)}
                      fullWidth
                    >
                      Pause
                    </Button>
                  )}

                  {(campaign.status === 'PAUSED' || campaign.status === 'DRAFT') && campaign.totalCalls > 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<PlayIcon />}
                      onClick={() => handleStartCampaign(campaign.id)}
                      fullWidth
                    >
                      Start
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Campaign Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create AI Voice Campaign</DialogTitle>
        <DialogContent>
          <TextField
            label="Campaign Name"
            fullWidth
            margin="normal"
            value={newCampaign.name}
            onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={newCampaign.description}
            onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
          />
          <TextField
            label="Script Template"
            fullWidth
            margin="normal"
            multiline
            rows={10}
            value={newCampaign.scriptTemplate}
            onChange={(e) => setNewCampaign({ ...newCampaign, scriptTemplate: e.target.value })}
            helperText="Use {{name}} and {{city}} for personalization"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateCampaign}
            variant="contained"
            disabled={!newCampaign.name || !newCampaign.scriptTemplate}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const DEFAULT_SCRIPT = `Hello! This is Maya from Slar Solar. Am I speaking with {{name}}?

I'm calling to share information about our solar panel installation services. We're currently offering special government subsidies that can reduce your costs by up to 40%.

Do you own a home or property in {{city}}?

Are you currently paying electricity bills over ₹3,000 per month?

With a solar system, you could save approximately ₹40,000 per year. Would you be interested in a free site survey to see how much you could save?

Excellent! I'll have one of our solar experts contact you within 24 hours to schedule the survey. Can you confirm your address?

Thank you! You'll receive a confirmation SMS shortly. Have a wonderful day!`;

export default AIVoiceCampaignsPage;

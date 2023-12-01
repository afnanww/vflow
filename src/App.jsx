import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import SingleDownloader from './pages/SingleDownloader';
import ChannelScanner from './pages/ChannelScanner';
import SavedChannels from './pages/SavedChannels';
import AccountManager from './pages/AccountManager';
import WorkflowBuilder from './pages/WorkflowBuilder';
import ExecutionHistory from './pages/ExecutionHistory';
import WorkflowExecutionDetails from './pages/WorkflowExecutionDetails';
import WorkflowProgress from './pages/WorkflowProgress';
import LiveWorkflows from './pages/LiveWorkflows';
import OAuthCallback from './pages/OAuthCallback';
import PreWorkflow from './pages/PreWorkflow';
import PreWorkflow2 from './pages/PreWorkflow2';
import WatermarkMaker from './pages/WatermarkMaker';

function App() {
    return (
        <Router>
            <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
                <Sidebar />
                <main className="flex-1 overflow-y-auto h-screen">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/single" element={<SingleDownloader />} />
                        <Route path="/channels" element={<ChannelScanner />} />
                        <Route path="/saved-channels" element={<SavedChannels />} />
                        <Route path="/accounts" element={<AccountManager />} />
                        <Route path="/workflows" element={<WorkflowBuilder />} />
                        <Route path="/pre-workflow" element={<PreWorkflow />} />
                        <Route path="/pre-workflow-2" element={<PreWorkflow2 />} />
                        <Route path="/live" element={<LiveWorkflows />} />
                        <Route path="/history" element={<ExecutionHistory />} />
                        <Route path="/workflows/:workflowId/executions/:executionId" element={<WorkflowProgress />} />
                        <Route path="/execution/:executionId" element={<WorkflowExecutionDetails />} />
                        <Route path="/watermark-maker" element={<WatermarkMaker />} />
                        <Route path="/auth/callback/:platform" element={<OAuthCallback />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;

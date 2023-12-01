import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    getIncomers
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Scan, Download, Flame, CloudUpload, Play, X, Settings, Save, FolderOpen, Plus, Trash2, Loader2, Lock, Unlock, History, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';


const CustomNode = ({ data, icon: Icon, color, label, selected, id }) => {
    const isActive = data.isActive;
    const isStart = data.isStart;

    const handleDelete = (e) => {
        e.stopPropagation();
        if (data.onDelete) {
            data.onDelete(id);
        }
    };

    return (
        <div className={cn(
            "px-3 py-2.5 shadow-md rounded-lg bg-card border-2 min-w-[100px] transition-all relative group",
            color,
            selected ? "ring-2 ring-offset-2 ring-primary" : "",
            isActive ? "ring-2 ring-offset-2 ring-yellow-400 animate-pulse" : ""
        )}>
            {isStart && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-lg z-10 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                    START
                </div>
            )}
            <Handle type="target" position={Position.Top} className={cn("w-4 h-4 !bg-primary border-2 border-background", isStart && "opacity-0 pointer-events-none")} />
            <div className="flex flex-col items-center gap-1.5">
                <div className="p-2 rounded-full bg-background/50">
                    <Icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-xs text-center leading-tight">{label}</div>
            </div>

            <button
                onClick={handleDelete}
                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:scale-110"
                title="Delete node"
            >
                <X className="w-3 h-3" />
            </button>
            <Handle type="source" position={Position.Bottom} className="w-4 h-4 !bg-primary border-2 border-background" />
        </div>
    );
};

const nodeTypes = {
    scan: (props) => <CustomNode {...props} icon={Scan} color="border-blue-500" label="Scan Channel" />,
    download: (props) => <CustomNode {...props} icon={Download} color="border-green-500" label="Download Video" />,

    burn: (props) => <CustomNode {...props} icon={Flame} color="border-orange-500" label="Burn Subs" />,
    upload: (props) => <CustomNode {...props} icon={CloudUpload} color="border-red-500" label="Upload" />,
};

const initialNodes = [];

const initialEdges = [];

export default function WorkflowBuilder() {
    const navigate = useNavigate();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState(null);
    const [workflows, setWorkflows] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [currentWorkflow, setCurrentWorkflow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [showLoadMenu, setShowLoadMenu] = useState(false);
    const [workflowName, setWorkflowName] = useState('New Workflow');
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);
    const [isCanvasLocked, setIsCanvasLocked] = useState(false);


    useEffect(() => {
        setNodes((nds) => nds.map((node) => {
            const incoming = getIncomers(node, nodes, edges);
            const isStart = incoming.length === 0;
            if (node.data.isStart !== isStart) {
                return { ...node, data: { ...node.data, isStart } };
            }
            return node;
        }));
    }, [edges, setNodes, nodes.length]);


    const handleDeleteNode = useCallback((nodeId) => {
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        if (selectedNode?.id === nodeId) {
            setSelectedNode(null);
        }
    }, [selectedNode, setNodes, setEdges]);


    useEffect(() => {
        setNodes((nds) => nds.map((node) => ({
            ...node,
            data: { ...node.data, onDelete: handleDeleteNode }
        })));
    }, [handleDeleteNode]);


    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
                handleDeleteNode(selectedNode.id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, handleDeleteNode]);

    useEffect(() => {
        fetchWorkflows();
        fetchAccounts();


        const ws = new WebSocket('ws://localhost:8000/ws/workflow-events');

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'log') {
                setLogs(prev => [...prev, message.data]);
            } else if (message.type === 'node_started') {
                setNodes(nds => nds.map(node => {
                    if (node.id === message.data.node_id) {
                        return { ...node, data: { ...node.data, isActive: true } };
                    }
                    return node;
                }));
            } else if (message.type === 'node_completed') {
                setNodes(nds => nds.map(node => {
                    if (node.id === message.data.node_id) {
                        return { ...node, data: { ...node.data, isActive: false } };
                    }
                    return node;
                }));
            } else if (message.type === 'workflow_completed' || message.type === 'workflow_failed') {
                setIsRunning(false);
                setNodes(nds => nds.map(node => ({ ...node, data: { ...node.data, isActive: false } })));
            }
        };

        return () => {
            ws.close();
        };
    }, []);

    const fetchWorkflows = async () => {
        try {
            const data = await api.workflows.list();
            setWorkflows(data);
        } catch (err) {
            console.error("Failed to fetch workflows:", err);
        }
    };

    const fetchAccounts = async () => {
        try {
            const data = await api.accounts.list();
            setAccounts(data);
        } catch (err) {
            console.error("Failed to fetch accounts:", err);
        }
    };

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onNodeClick = (event, node) => {
        setSelectedNode(node);
    };

    const updateNodeConfig = (key, value) => {
        if (!selectedNode) return;

        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNode.id) {
                    const updatedNode = {
                        ...node,
                        data: {
                            ...node.data,
                            config: { ...node.data.config, [key]: value },
                        },
                    };
                    setSelectedNode(updatedNode);
                    return updatedNode;
                }
                return node;
            })
        );
    };

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (!type) return;

            const reactFlowBounds = event.target.getBoundingClientRect();
            const position = {
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            };

            const newNode = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: {
                    label: type.charAt(0).toUpperCase() + type.slice(1),
                    config: {}
                },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes]
    );

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const workflowData = {
                nodes: nodes.map(n => ({ ...n, data: { ...n.data, isActive: false } })),
                edges,
            };

            let saved;
            if (currentWorkflow) {
                saved = await api.workflows.update(currentWorkflow.id, {
                    name: workflowName,
                    workflow_data: workflowData,
                });
            } else {
                saved = await api.workflows.create({
                    name: workflowName,
                    description: "Created via Workflow Builder",
                    workflow_data: workflowData,
                    is_active: true,
                });
            }

            setCurrentWorkflow(saved);
            await fetchWorkflows();
            alert(currentWorkflow ? 'Workflow updated successfully!' : 'Workflow created successfully!');
        } catch (err) {
            console.error("Failed to save workflow:", err);
            alert(`Failed to save workflow: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoad = (workflow) => {
        setCurrentWorkflow(workflow);
        setWorkflowName(workflow.name);
        if (workflow.workflow_data) {
            setNodes(workflow.workflow_data.nodes || []);
            setEdges(workflow.workflow_data.edges || []);
        }
        setShowLoadMenu(false);
    };

    const handleNew = () => {
        setCurrentWorkflow(null);
        setWorkflowName('New Workflow');
        setNodes(initialNodes);
        setEdges(initialEdges);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this workflow?')) return;

        try {
            await api.workflows.delete(id);
            if (currentWorkflow?.id === id) {
                handleNew();
            }
            await fetchWorkflows();
        } catch (err) {
            console.error("Failed to delete workflow:", err);
        }
    };

    const handleRun = async () => {
        if (!currentWorkflow) {
            alert('Please save the workflow first');
            return;
        }

        setIsRunning(true);
        try {
            await api.workflows.execute(currentWorkflow.id);
            navigate('/live');
        } catch (err) {
            console.error("Failed to execute workflow:", err);
            alert('Failed to start workflow');
            setIsRunning(false);
        }
    };

    return (
        <div className="h-full flex flex-col relative">
            <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-4">
                    <div>
                        <input
                            type="text"
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                            className="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-64"
                        />
                        <p className="text-xs text-muted-foreground">
                            Drag nodes from the left panel • Connect by dragging from bottom dot to top dot • Delete: hover & click X or press Delete key
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowLoadMenu(!showLoadMenu)}
                            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-colors text-sm font-medium"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Load
                        </button>
                        {showLoadMenu && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 p-2">
                                <div className="flex justify-between items-center px-2 py-1 mb-2">
                                    <span className="text-xs font-bold text-muted-foreground">SAVED WORKFLOWS</span>
                                    <button onClick={handleNew} className="text-xs text-primary hover:underline flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> New
                                    </button>
                                </div>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {workflows.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-2 py-2">No saved workflows</p>
                                    ) : (
                                        workflows.map(w => (
                                            <div
                                                key={w.id}
                                                onClick={() => handleLoad(w)}
                                                className="flex items-center justify-between px-2 py-2 rounded hover:bg-accent cursor-pointer text-sm group"
                                            >
                                                <span className="truncate max-w-[140px]">{w.name}</span>
                                                <button
                                                    onClick={(e) => handleDelete(e, w.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-colors text-sm font-medium"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isRunning || !currentWorkflow}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Run Workflow
                    </button>
                    {currentWorkflow && (
                        <button
                            onClick={() => navigate(`/history?workflow_id=${currentWorkflow.id}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-colors text-sm font-medium"
                            title="View Execution History"
                        >
                            <History className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 relative bg-accent/10">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    onNodeClick={onNodeClick}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    nodesDraggable={true}
                    panOnDrag={!isCanvasLocked}
                    zoomOnScroll={!isCanvasLocked}
                    zoomOnPinch={!isCanvasLocked}
                    zoomOnDoubleClick={!isCanvasLocked}
                    panOnScroll={!isCanvasLocked}
                    minZoom={0.5}
                    maxZoom={2}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    fitView
                >
                    <Controls showZoom={!isCanvasLocked} showFitView={true} showInteractive={!isCanvasLocked} />
                    <MiniMap />
                    <Background variant="dots" gap={12} size={1} />
                </ReactFlow>


                <div className="absolute top-4 left-4 bg-card border border-border p-4 rounded-xl shadow-lg w-48">
                    <h3 className="font-medium mb-3 text-sm">Nodes</h3>
                    <div className="space-y-2">
                        {Object.entries(nodeTypes).map(([type, _]) => (
                            <button
                                key={type}
                                onClick={() => {
                                    const newNode = {
                                        id: `${type}-${Date.now()}`,
                                        type,
                                        position: { x: 250, y: nodes.length * 100 + 50 },
                                        data: {
                                            label: type.charAt(0).toUpperCase() + type.slice(1),
                                            config: {}
                                        },
                                    };
                                    setNodes((nds) => nds.concat(newNode));
                                }}
                                className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer border border-transparent hover:border-border text-sm capitalize w-full transition-colors"
                            >
                                <div className={cn("w-2 h-2 rounded-full",
                                    type === 'scan' ? "bg-blue-500" :
                                        type === 'download' ? "bg-green-500" :
                                            type === 'burn' ? "bg-orange-500" : "bg-red-500"
                                )} />
                                {type}
                            </button>
                        ))}
                    </div>


                    <div className="mt-4 pt-4 border-t border-border">
                        <button
                            onClick={() => setIsCanvasLocked(!isCanvasLocked)}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                                isCanvasLocked
                                    ? "bg-orange-500 text-white hover:bg-orange-600"
                                    : "bg-accent text-accent-foreground hover:bg-accent/80"
                            )}
                            title={isCanvasLocked ? "Unlock canvas (enable pan/zoom)" : "Lock canvas (disable pan/zoom)"}
                        >
                            {isCanvasLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {isCanvasLocked ? "Locked" : "Unlocked"}
                        </button>
                    </div>
                </div>


                {showLogs && (
                    <div className="absolute bottom-4 left-4 right-4 h-48 bg-black/90 text-green-400 p-4 rounded-xl shadow-lg font-mono text-xs overflow-y-auto border border-green-900/50">
                        <div className="flex justify-between items-center mb-2 sticky top-0 bg-black/90 pb-2 border-b border-green-900/30">
                            <span className="font-bold flex items-center gap-2">
                                <Loader2 className={cn("w-3 h-3", isRunning ? "animate-spin" : "hidden")} />
                                Execution Logs
                            </span>
                            <button onClick={() => setShowLogs(false)} className="hover:text-white"><X className="w-3 h-3" /></button>
                        </div>
                        <div className="space-y-1">
                            {logs.map((log, i) => (
                                <div key={i} className="break-all">
                                    <span className="opacity-50 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    <span className={log.level === 'error' ? 'text-red-500' : ''}>{log.message}</span>
                                </div>
                            ))}
                            {logs.length === 0 && <div className="opacity-50 italic">Waiting for logs...</div>}
                        </div>
                    </div>
                )}


                {selectedNode && (
                    <div className="absolute top-4 right-4 bg-card border border-border p-6 rounded-xl shadow-lg w-80 animate-in slide-in-from-right-4">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Configure Node
                            </h3>
                            <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 bg-accent/50 rounded-lg mb-4">
                                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Type</p>
                                <p className="capitalize font-medium">{selectedNode.type}</p>
                            </div>

                            {selectedNode.type === 'scan' && (
                                <>
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium">Channel URL</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 rounded border border-input bg-background text-sm"
                                            placeholder="https://..."
                                            value={selectedNode.data.config?.url || ''}
                                            onChange={(e) => updateNodeConfig('url', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium">Video Limit</label>
                                        <select
                                            className="w-full p-2 rounded border border-input bg-background text-sm"
                                            value={selectedNode.data.config?.video_limit || 'all'}
                                            onChange={(e) => updateNodeConfig('video_limit', e.target.value)}
                                        >
                                            <option value="all">All Videos</option>
                                            <option value="5">Latest 5 Videos</option>
                                            <option value="10">Latest 10 Videos</option>
                                            <option value="20">Latest 20 Videos</option>
                                            <option value="50">Latest 50 Videos</option>
                                            <option value="100">Latest 100 Videos</option>
                                        </select>
                                        <p className="text-xs text-muted-foreground">
                                            Choose how many videos to scan from the channel
                                        </p>
                                    </div>
                                </>
                            )}

                            {selectedNode.type === 'download' && (
                                <>
                                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                                        <span className="text-sm font-medium">Download Subtitles</span>
                                        <input
                                            type="checkbox"
                                            checked={selectedNode.data.config?.download_subtitles !== false} // Default true
                                            onChange={(e) => updateNodeConfig('download_subtitles', e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                    </div>
                                    {selectedNode.data.config?.download_subtitles !== false && (
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">Subtitle Language</label>
                                            <select
                                                className="w-full p-2 rounded border border-input bg-background text-sm"
                                                value={selectedNode.data.config?.subtitle_language || 'en'}
                                                onChange={(e) => updateNodeConfig('subtitle_language', e.target.value)}
                                            >
                                                <option value="en">English</option>
                                                <option value="zh">Chinese</option>
                                                <option value="es">Spanish</option>
                                                <option value="id">Indonesian</option>
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}



                            {selectedNode.type === 'burn' && (
                                <>
                                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                                        <span className="text-sm font-medium">Add Watermark</span>
                                        <input
                                            type="checkbox"
                                            checked={selectedNode.data.config?.add_watermark || false}
                                            onChange={(e) => updateNodeConfig('add_watermark', e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                    </div>
                                    {selectedNode.data.config?.add_watermark && (
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">Watermark Text</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 rounded border border-input bg-background text-sm"
                                                placeholder="e.g. My Channel Name"
                                                value={selectedNode.data.config?.watermark_text || ''}
                                                onChange={(e) => updateNodeConfig('watermark_text', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {selectedNode.type === 'upload' && (
                                <>
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium">Platform</label>
                                        <select
                                            className="w-full p-2 rounded border border-input bg-background text-sm"
                                            value={selectedNode.data.config?.platform || 'youtube'}
                                            onChange={(e) => updateNodeConfig('platform', e.target.value)}
                                        >
                                            <option value="youtube">YouTube</option>
                                            <option value="tiktok">TikTok</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium">Account</label>
                                        <select
                                            className="w-full p-2 rounded border border-input bg-background text-sm"
                                            value={selectedNode.data.config?.account || ''}
                                            onChange={(e) => updateNodeConfig('account', e.target.value)}
                                        >
                                            <option value="">Select Account...</option>
                                            {accounts
                                                .filter(acc => acc.platform === (selectedNode.data.config?.platform || 'youtube'))
                                                .map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.username} ({acc.platform})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

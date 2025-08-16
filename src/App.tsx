import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import type { Edge, OnConnect } from 'reactflow';
import { WorkflowNode } from './components/WorkflowNode';
import { SaveButton } from './components/SaveButton';
import { EdgeContextMenu } from './components/EdgeContextMenu';
import { NodeContextMenu } from './components/NodeContextMenu';
import { ReEnumerateButton } from './components/ReEnumerateButton';
import './components/WorkflowNode.css';
import './components/SaveButton.css';
import './components/EdgeContextMenu.css';
import './components/NodeContextMenu.css';
import './components/ReEnumerateButton.css';
import 'reactflow/dist/style.css';
import './App.css'
import { logger } from './utils/logger';
import { stateManager } from './utils/stateManager';


function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [edgeContextMenu, setEdgeContextMenu] = React.useState<{
    edge: Edge | null;
    position: { x: number; y: number } | null;
  }>({ edge: null, position: null });
  
  const [nodeContextMenu, setNodeContextMenu] = React.useState<{
    node: any | null;
    position: { x: number; y: number } | null;
  }>({ node: null, position: null });
  
  const [orphanedCount, setOrphanedCount] = React.useState(0);

  // Memoize nodeTypes to prevent recreation on each render
  const nodeTypes = useMemo(() => ({
    workflowNode: WorkflowNode,
  }), []);

  useEffect(() => {
    const initializeWorkflow = async () => {
      try {
        logger.info('App component mounted - initializing workflow');
        
        // Initialize workflow state from markdown files and existing config
        const { nodes: initialNodes, edges: initialEdges } = await stateManager.initializeWorkflowState();
        
        setNodes(initialNodes);
        setEdges(initialEdges);
        
        // Count orphaned nodes
        const orphanedNodes = stateManager.getState().nodes.filter(node => node.isOrphaned).length;
        setOrphanedCount(orphanedNodes);
        
        setIsInitialized(true);
        
        logger.logEvent('workflow_loaded', { nodeCount: initialNodes.length, edgeCount: initialEdges.length, orphanedCount: orphanedNodes });
      } catch (error) {
        logger.error('Failed to initialize workflow', error as Error);
        setIsInitialized(true); // Still set to true to show empty workflow
      }
    };

    initializeWorkflow();

    // Add keyboard event listener for edge deletion
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete selected edges
        setEdges((currentEdges) => {
          const selectedEdges = currentEdges.filter(edge => edge.selected);
          if (selectedEdges.length > 0) {
            selectedEdges.forEach(edge => {
              logger.logUserAction('delete_edge_keyboard', `Deleted edge ${edge.id} via keyboard`);
              stateManager.removeEdge(edge.id);
            });
            const remainingEdges = currentEdges.filter(edge => !edge.selected);
            stateManager.updateEdges(remainingEdges);
            return remainingEdges;
          }
          return currentEdges;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setEdges, setNodes]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      logger.logUserAction('connect_nodes', `${params.source}:${params.sourceHandle} -> ${params.target}:${params.targetHandle}`);
      
      // Determine edge color and label based on handle types
      let edgeColor = '#555';
      let edgeLabel = 'connection';
      
      if (params.sourceHandle === 'output-main') {
        edgeColor = '#FF9800';
        edgeLabel = 'main flow';
      } else if (params.sourceHandle === 'output-alt') {
        edgeColor = '#E91E63';
        edgeLabel = 'alt flow';
      }
      
      const newEdge = {
        ...params,
        animated: true,
        label: edgeLabel,
        style: { stroke: edgeColor, strokeWidth: 2 },
      };
      
      setEdges((eds) => {
        const newEdges = addEdge(newEdge, eds);
        // Update state manager with new edges
        stateManager.updateEdges(newEdges);
        return newEdges;
      });
    },
    [setEdges]
  );

  const onNodesChangeWithLogging = useCallback(
    (changes: any[]) => {
      changes.forEach(change => {
        if (change.type === 'dimensions' && change.dimensions) {
          logger.logUserAction('resize_node', `Node ${change.id} resized to ${change.dimensions.width}x${change.dimensions.height}`);
          stateManager.updateNodeSize(change.id, change.dimensions);
        } else if (change.type === 'position' && change.position) {
          stateManager.updateNodePosition(change.id, change.position);
        }
      });
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const onEdgesChangeWithLogging = useCallback(
    (changes: any[]) => {
      changes.forEach(change => {
        if (change.type === 'remove') {
          logger.logUserAction('remove_edge', `Removed edge ${change.id}`);
          stateManager.removeEdge(change.id);
        } else if (change.type === 'add') {
          logger.logUserAction('add_edge', `Added edge ${change.id}`);
          // Edge addition is handled in onConnect
        }
      });
      onEdgesChange(changes);
      
      // Update state manager with current edges after any change
      setTimeout(() => {
        setEdges((currentEdges) => {
          stateManager.updateEdges(currentEdges);
          return currentEdges;
        });
      }, 0);
    },
    [onEdgesChange, setEdges]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setEdgeContextMenu({
        edge,
        position: { x: event.clientX, y: event.clientY },
      });
      logger.logUserAction('edge_context_menu', `Context menu opened for edge ${edge.id}`);
    },
    []
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      event.preventDefault();
      setNodeContextMenu({
        node,
        position: { x: event.clientX, y: event.clientY },
      });
      logger.logUserAction('node_context_menu', `Context menu opened for node ${node.id}`);
    },
    []
  );

  const handleEdgeContextMenuClose = useCallback(() => {
    setEdgeContextMenu({ edge: null, position: null });
  }, []);

  const handleNodeContextMenuClose = useCallback(() => {
    setNodeContextMenu({ node: null, position: null });
  }, []);

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((currentEdges) => {
        const remainingEdges = currentEdges.filter(edge => edge.id !== edgeId);
        stateManager.removeEdge(edgeId);
        stateManager.updateEdges(remainingEdges);
        logger.logUserAction('delete_edge_context', `Deleted edge ${edgeId} via context menu`);
        return remainingEdges;
      });
    },
    [setEdges]
  );

  const handleEdgeEdit = useCallback(
    (edge: Edge) => {
      const newLabel = prompt('Enter new label for edge:', edge.label as string || '');
      if (newLabel !== null && newLabel !== edge.label) {
        setEdges((currentEdges) => {
          const updatedEdges = currentEdges.map(e => 
            e.id === edge.id ? { ...e, label: newLabel } : e
          );
          stateManager.updateEdges(updatedEdges);
          logger.logUserAction('edit_edge_label', `Changed edge ${edge.id} label to: ${newLabel}`);
          return updatedEdges;
        });
      }
    },
    [setEdges]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => {
        const remainingNodes = currentNodes.filter(node => node.id !== nodeId);
        
        // Remove related edges
        setEdges((currentEdges) => {
          const remainingEdges = currentEdges.filter(edge => 
            edge.source !== nodeId && edge.target !== nodeId
          );
          stateManager.updateEdges(remainingEdges);
          return remainingEdges;
        });
        
        // Remove from state manager
        stateManager.removeNode(nodeId);
        
        // Update orphaned count
        const orphanedNodes = stateManager.getState().nodes.filter(node => node.isOrphaned).length;
        setOrphanedCount(orphanedNodes);
        
        logger.logUserAction('delete_node', `Deleted node ${nodeId}`);
        return remainingNodes;
      });
    },
    [setNodes, setEdges]
  );

  const handleCleanupOrphaned = useCallback(() => {
    const removedCount = stateManager.removeOrphanedNodes();
    if (removedCount > 0) {
      const remainingNodes = stateManager.toReactFlowNodes();
      setNodes(remainingNodes);
      
      // Remove edges connected to removed nodes
      const nodeIds = new Set(remainingNodes.map(n => n.id));
      setEdges((currentEdges) => {
        const remainingEdges = currentEdges.filter(edge => 
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
        stateManager.updateEdges(remainingEdges);
        return remainingEdges;
      });
      
      setOrphanedCount(0);
      logger.logUserAction('cleanup_orphaned', `Removed ${removedCount} orphaned nodes`);
    }
  }, [setNodes, setEdges]);

  const handleReEnumerate = useCallback(
    (result: { nodes: any[]; edges: Edge[]; newNodes: number; recoveredNodes: number }) => {
      setNodes(result.nodes);
      setEdges(result.edges);
      
      // Update orphaned count
      const orphanedNodes = stateManager.getState().nodes.filter(node => node.isOrphaned).length;
      setOrphanedCount(orphanedNodes);
      
      // Show notification about results
      if (result.newNodes > 0 || result.recoveredNodes > 0) {
        const message = [];
        if (result.newNodes > 0) message.push(`${result.newNodes} new node${result.newNodes > 1 ? 's' : ''}`);
        if (result.recoveredNodes > 0) message.push(`${result.recoveredNodes} recovered node${result.recoveredNodes > 1 ? 's' : ''}`);
        logger.info(`Re-enumeration complete: ${message.join(', ')}`);
      } else {
        logger.info('Re-enumeration complete: no changes');
      }
    },
    [setNodes, setEdges]
  );

  if (!isInitialized) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading workflow...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <SaveButton />
      <ReEnumerateButton onReEnumerate={handleReEnumerate} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithLogging}
        onEdgesChange={onEdgesChangeWithLogging}
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        elementsSelectable
        selectNodesOnDrag={false}
      >
        <Controls />
        <MiniMap />
        <Background variant={'dots' as any} gap={12} size={1} />
      </ReactFlow>
      
      <EdgeContextMenu
        edge={edgeContextMenu.edge}
        position={edgeContextMenu.position}
        onClose={handleEdgeContextMenuClose}
        onDelete={handleEdgeDelete}
        onEdit={handleEdgeEdit}
      />
      
      <NodeContextMenu
        node={nodeContextMenu.node}
        position={nodeContextMenu.position}
        onClose={handleNodeContextMenuClose}
        onDelete={handleNodeDelete}
        onCleanupOrphaned={handleCleanupOrphaned}
        orphanedCount={orphanedCount}
      />
    </div>
  );
}

export default App

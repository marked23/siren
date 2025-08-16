import type { Node, Edge } from 'reactflow';
import { logger } from './logger';

export interface NodeState {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isCollapsed: boolean;
  expandedSize?: { width: number; height: number }; // Store size before collapse
  minDimensions: {
    width: number;
    height: number;
    collapsedWidth: number;
    collapsedHeight: number;
  };
  data: {
    label: string;
    markdownPath: string;
  };
  isOrphaned?: boolean; // True if the markdown file is missing
}

export interface WorkflowState {
  nodes: NodeState[];
  edges: Edge[];
  lastSaved: string;
  version: string;
}

class StateManager {
  private state: WorkflowState = {
    nodes: [],
    edges: [],
    lastSaved: '',
    version: '1.0.0'
  };

  private stateFilePath = '/tmp/workflow-state.json';
  private workflowConfigPath = '/workflows/nodes-and-edges.json';
  private baseUrl = `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001/api`;

  // Initialize state from React Flow nodes
  initializeFromNodes(nodes: Node[], edges: Edge[]): void {
    this.state.nodes = nodes.map(node => ({
      id: node.id,
      position: node.position,
      size: {
        width: node.style?.width as number || 250,
        height: node.style?.height as number || 200
      },
      isCollapsed: false,
      minDimensions: {
        width: 250,
        height: 200,
        collapsedWidth: 180,
        collapsedHeight: 50
      },
      data: node.data || {
        label: `Node ${node.id}`,
        markdownPath: `/workflows/node-${node.id}.md`
      }
    }));
    this.state.edges = edges;
    logger.info(`State manager initialized with ${nodes.length} nodes and ${edges.length} edges`);
  }

  // Get current state
  getState(): WorkflowState {
    return { ...this.state };
  }

  // Update node position
  updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const nodeState = this.state.nodes.find(n => n.id === nodeId);
    if (nodeState) {
      nodeState.position = position;
      logger.debug(`Updated position for node ${nodeId}: (${position.x}, ${position.y})`);
    }
  }

  // Update node size
  updateNodeSize(nodeId: string, size: { width: number; height: number }): void {
    const nodeState = this.state.nodes.find(n => n.id === nodeId);
    if (nodeState) {
      nodeState.size = size;
      if (!nodeState.isCollapsed) {
        nodeState.expandedSize = size; // Store as expanded size if not collapsed
      }
      logger.debug(`Updated size for node ${nodeId}: ${size.width}x${size.height}`);
    }
  }

  // Update node minimum dimensions
  updateNodeMinDimensions(nodeId: string, minDimensions: NodeState['minDimensions']): void {
    const nodeState = this.state.nodes.find(n => n.id === nodeId);
    if (nodeState) {
      nodeState.minDimensions = minDimensions;
      logger.debug(`Updated min dimensions for node ${nodeId}: ${minDimensions.width}x${minDimensions.height} (expanded), ${minDimensions.collapsedWidth}x${minDimensions.collapsedHeight} (collapsed)`);
    }
  }

  // Add new edge
  addEdge(edge: Edge): void {
    const existingEdge = this.state.edges.find(e => e.id === edge.id);
    if (!existingEdge) {
      this.state.edges.push(edge);
      logger.info(`Added edge ${edge.id}: ${edge.source} -> ${edge.target}`);
    }
  }

  // Remove edge
  removeEdge(edgeId: string): void {
    const edgeIndex = this.state.edges.findIndex(e => e.id === edgeId);
    if (edgeIndex !== -1) {
      const edge = this.state.edges[edgeIndex];
      this.state.edges.splice(edgeIndex, 1);
      logger.info(`Removed edge ${edgeId}: ${edge.source} -> ${edge.target}`);
    }
  }

  // Update edges (replace entire edge array)
  updateEdges(edges: Edge[]): void {
    this.state.edges = [...edges];
    logger.debug(`Updated edges array with ${edges.length} edges`);
  }

  // Get edges
  getEdges(): Edge[] {
    return [...this.state.edges];
  }

  // Toggle node collapse state
  toggleNodeCollapse(nodeId: string): { newSize: { width: number; height: number }; isCollapsed: boolean } {
    const nodeState = this.state.nodes.find(n => n.id === nodeId);
    if (!nodeState) {
      throw new Error(`Node ${nodeId} not found in state`);
    }

    const wasCollapsed = nodeState.isCollapsed;
    nodeState.isCollapsed = !wasCollapsed;

    let newSize: { width: number; height: number };

    if (nodeState.isCollapsed) {
      // Collapsing: store current size as expanded size, use collapsed size
      nodeState.expandedSize = nodeState.size;
      newSize = {
        width: nodeState.minDimensions.collapsedWidth,
        height: nodeState.minDimensions.collapsedHeight
      };
    } else {
      // Expanding: restore previous expanded size or use minimum expanded size
      newSize = nodeState.expandedSize || {
        width: nodeState.minDimensions.width,
        height: nodeState.minDimensions.height
      };
    }

    nodeState.size = newSize;
    logger.info(`Toggled collapse for node ${nodeId}: ${nodeState.isCollapsed ? 'collapsed' : 'expanded'} to ${newSize.width}x${newSize.height}`);

    return { newSize, isCollapsed: nodeState.isCollapsed };
  }

  // Get node state
  getNodeState(nodeId: string): NodeState | undefined {
    return this.state.nodes.find(n => n.id === nodeId);
  }

  // Remove node from state (does not delete markdown file)
  removeNode(nodeId: string): void {
    const nodeIndex = this.state.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex !== -1) {
      const node = this.state.nodes[nodeIndex];
      this.state.nodes.splice(nodeIndex, 1);
      logger.info(`Removed node ${nodeId} (${node.data.label}) from state`);
    }
  }

  // Mark nodes as orphaned if their markdown files don't exist
  async markOrphanedNodes(): Promise<void> {
    const markdownFiles = await this.enumerateMarkdownFiles();
    const existingFiles = new Set(markdownFiles.map(file => `/workflows/${file}`));
    
    let orphanedCount = 0;
    this.state.nodes.forEach(node => {
      const wasOrphaned = node.isOrphaned;
      node.isOrphaned = !existingFiles.has(node.data.markdownPath);
      
      if (node.isOrphaned && !wasOrphaned) {
        orphanedCount++;
        logger.warn(`Node ${node.id} (${node.data.label}) marked as orphaned - file not found: ${node.data.markdownPath}`);
      } else if (!node.isOrphaned && wasOrphaned) {
        logger.info(`Node ${node.id} (${node.data.label}) recovered - file found: ${node.data.markdownPath}`);
      }
    });
    
    if (orphanedCount > 0) {
      logger.warn(`Found ${orphanedCount} orphaned nodes`);
    }
  }

  // Remove all orphaned nodes
  removeOrphanedNodes(): number {
    const initialCount = this.state.nodes.length;
    this.state.nodes = this.state.nodes.filter(node => !node.isOrphaned);
    const removedCount = initialCount - this.state.nodes.length;
    
    if (removedCount > 0) {
      logger.info(`Removed ${removedCount} orphaned nodes from state`);
    }
    
    return removedCount;
  }

  // Save state to disk
  async saveStateToDisk(): Promise<void> {
    try {
      this.state.lastSaved = new Date().toISOString();
      const stateJson = JSON.stringify(this.state, null, 2);
      
      const response = await fetch(`${this.baseUrl}/save-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: this.stateFilePath,
          content: stateJson
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save state: ${response.statusText}`);
      }

      logger.info(`Workflow state saved to ${this.stateFilePath}`);
    } catch (error) {
      logger.error('Failed to save workflow state', error as Error);
      throw error;
    }
  }

  // Load state from disk
  async loadStateFromDisk(): Promise<WorkflowState | null> {
    try {
      const response = await fetch(`${this.baseUrl}/load-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: this.stateFilePath
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.info('No saved state file found');
          return null;
        }
        throw new Error(`Failed to load state: ${response.statusText}`);
      }

      const savedState: WorkflowState = await response.json();
      this.state = savedState;
      logger.info(`Workflow state loaded from ${this.stateFilePath}`);
      return savedState;
    } catch (error) {
      logger.error('Failed to load workflow state', error as Error);
      return null;
    }
  }

  // Convert state to React Flow nodes
  toReactFlowNodes(): Node[] {
    return this.state.nodes.map(nodeState => ({
      id: nodeState.id,
      type: 'workflowNode',
      position: nodeState.position,
      style: {
        width: nodeState.size.width,
        height: nodeState.size.height
      },
      data: nodeState.data
    }));
  }

  // Load workflow configuration from public/workflows/nodes-and-edges.json
  async loadWorkflowConfig(): Promise<WorkflowState | null> {
    try {
      const response = await fetch(this.workflowConfigPath);
      
      if (!response.ok) {
        if (response.status === 404) {
          logger.info('No workflow config file found, will create one');
          return null;
        }
        throw new Error(`Failed to load workflow config: ${response.statusText}`);
      }

      const config: WorkflowState = await response.json();
      logger.info(`Workflow config loaded from ${this.workflowConfigPath}`);
      return config;
    } catch (error) {
      logger.error('Failed to load workflow config', error as Error);
      return null;
    }
  }

  // Enumerate markdown files in public/workflows
  async enumerateMarkdownFiles(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/enumerate-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directory: './public/workflows',
          extension: '.md'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to enumerate files: ${response.statusText}`);
      }

      const files: string[] = await response.json();
      logger.info(`Found ${files.length} markdown files in workflows directory`);
      return files;
    } catch (error) {
      logger.error('Failed to enumerate markdown files', error as Error);
      return [];
    }
  }

  // Calculate grid position for new nodes
  private calculateGridPosition(index: number, nodeWidth: number = 250, nodeHeight: number = 200): { x: number; y: number } {
    const cols = 3; // 3 nodes per row
    const paddingX = 50;
    const paddingY = 50;
    
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    return {
      x: paddingX + col * (nodeWidth + paddingX),
      y: paddingY + row * (nodeHeight + paddingY)
    };
  }

  // Generate label from markdown filename
  private generateLabelFromFilename(filename: string): string {
    return filename
      .replace(/\.md$/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Initialize workflow state from markdown files and existing config
  async initializeWorkflowState(): Promise<{ nodes: Node[]; edges: Edge[] }> {
    // Load existing config
    const existingConfig = await this.loadWorkflowConfig();
    
    // Enumerate markdown files
    const markdownFiles = await this.enumerateMarkdownFiles();
    
    let nodes: NodeState[] = [];
    let edges: Edge[] = [];
    let nextNodeId = 1;
    
    if (existingConfig) {
      nodes = [...existingConfig.nodes];
      edges = [...existingConfig.edges];
      
      // Find the next available node ID
      const existingIds = nodes.map(n => parseInt(n.id)).filter(id => !isNaN(id));
      nextNodeId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    }
    
    // Check for orphaned nodes (nodes with missing markdown files)
    const existingFiles = new Set(markdownFiles.map(file => `/workflows/${file}`));
    nodes.forEach(node => {
      node.isOrphaned = !existingFiles.has(node.data.markdownPath);
      if (node.isOrphaned) {
        logger.warn(`Node ${node.id} (${node.data.label}) is orphaned - file not found: ${node.data.markdownPath}`);
      }
    });
    
    // Check for new markdown files not in existing config
    const existingPaths = new Set(nodes.map(n => n.data.markdownPath));
    const newFiles = markdownFiles.filter(file => !existingPaths.has(`/workflows/${file}`));
    
    if (newFiles.length > 0) {
      logger.info(`Found ${newFiles.length} new markdown files to add`);
      
      // Add new nodes for new markdown files
      newFiles.forEach((file, index) => {
        const nodeId = (nextNodeId + index).toString();
        const position = this.calculateGridPosition(nodes.length + index);
        
        const newNode: NodeState = {
          id: nodeId,
          position,
          size: { width: 250, height: 200 },
          isCollapsed: true, // Start collapsed as requested
          minDimensions: {
            width: 250,
            height: 200,
            collapsedWidth: 180,
            collapsedHeight: 50
          },
          data: {
            label: this.generateLabelFromFilename(file),
            markdownPath: `/workflows/${file}`
          },
          isOrphaned: false
        };
        
        nodes.push(newNode);
      });
      
      // Save updated config
      await this.saveWorkflowConfig({ nodes, edges, lastSaved: new Date().toISOString(), version: '1.0.0' });
    }
    
    // Update internal state
    this.state = { nodes, edges, lastSaved: new Date().toISOString(), version: '1.0.0' };
    
    // Convert to React Flow format
    const reactFlowNodes = this.toReactFlowNodes();
    
    logger.info(`Initialized workflow with ${nodes.length} nodes and ${edges.length} edges`);
    return { nodes: reactFlowNodes, edges };
  }

  // Re-enumerate markdown files and update nodes accordingly
  async reEnumerateMarkdownFiles(): Promise<{ nodes: Node[]; edges: Edge[]; newNodes: number; recoveredNodes: number }> {
    logger.info('Re-enumerating markdown files and updating workflow state');
    
    const markdownFiles = await this.enumerateMarkdownFiles();
    const existingFiles = new Set(markdownFiles.map(file => `/workflows/${file}`));
    
    let recoveredNodes = 0;
    let newNodes = 0;
    
    // Update orphaned status for existing nodes
    this.state.nodes.forEach(node => {
      const wasOrphaned = node.isOrphaned;
      node.isOrphaned = !existingFiles.has(node.data.markdownPath);
      
      if (wasOrphaned && !node.isOrphaned) {
        recoveredNodes++;
        logger.info(`Node ${node.id} (${node.data.label}) recovered - file found: ${node.data.markdownPath}`);
      }
    });
    
    // Find new markdown files not in existing config
    const existingPaths = new Set(this.state.nodes.map(n => n.data.markdownPath));
    const newFiles = markdownFiles.filter(file => !existingPaths.has(`/workflows/${file}`));
    
    if (newFiles.length > 0) {
      logger.info(`Found ${newFiles.length} new markdown files to add`);
      
      // Find the next available node ID
      const existingIds = this.state.nodes.map(n => parseInt(n.id)).filter(id => !isNaN(id));
      let nextNodeId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      
      // Add new nodes for new markdown files
      newFiles.forEach((file, index) => {
        const nodeId = (nextNodeId + index).toString();
        const position = this.calculateGridPosition(this.state.nodes.length + index);
        
        const newNode: NodeState = {
          id: nodeId,
          position,
          size: { width: 250, height: 200 },
          isCollapsed: true,
          minDimensions: {
            width: 250,
            height: 200,
            collapsedWidth: 180,
            collapsedHeight: 50
          },
          data: {
            label: this.generateLabelFromFilename(file),
            markdownPath: `/workflows/${file}`
          },
          isOrphaned: false
        };
        
        this.state.nodes.push(newNode);
        newNodes++;
      });
    }
    
    // Save updated config
    this.state.lastSaved = new Date().toISOString();
    await this.saveWorkflowConfig(this.state);
    
    // Convert to React Flow format
    const reactFlowNodes = this.toReactFlowNodes();
    
    logger.info(`Re-enumeration complete: ${newNodes} new nodes, ${recoveredNodes} recovered nodes`);
    return { 
      nodes: reactFlowNodes, 
      edges: this.state.edges, 
      newNodes, 
      recoveredNodes 
    };
  }

  // Save workflow configuration to public/workflows/nodes-and-edges.json
  async saveWorkflowConfig(config: WorkflowState): Promise<void> {
    try {
      const configJson = JSON.stringify(config, null, 2);
      
      const response = await fetch(`${this.baseUrl}/save-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: `./public${this.workflowConfigPath}`,
          content: configJson
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save workflow config: ${response.statusText}`);
      }

      logger.info(`Workflow config saved to ${this.workflowConfigPath}`);
    } catch (error) {
      logger.error('Failed to save workflow config', error as Error);
      throw error;
    }
  }
}

export const stateManager = new StateManager();
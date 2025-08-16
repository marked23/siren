import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import mermaid from 'mermaid';
import { logger } from '../utils/logger';
import { stateManager } from '../utils/stateManager';

mermaid.initialize({ startOnLoad: true });

interface WorkflowNodeProps {
  data: {
    label: string;
    markdownPath: string;
  };
  id: string;
  selected?: boolean;
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ data, id, selected }) => {
  const [markdown, setMarkdown] = useState<string>('');
  const [minDimensions, setMinDimensions] = useState({ 
    width: 250, 
    height: 200, 
    collapsedWidth: 180, 
    collapsedHeight: 50 
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOrphaned, setIsOrphaned] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  const mermaidRef = useRef<HTMLDivElement>(null);
  const { setNodes } = useReactFlow();

  // Get initial state from state manager
  useEffect(() => {
    const nodeState = stateManager.getNodeState(id);
    if (nodeState) {
      setIsCollapsed(nodeState.isCollapsed);
      setMinDimensions(nodeState.minDimensions);
      setIsOrphaned(nodeState.isOrphaned || false);
    }
  }, [id]);

  useEffect(() => {
    logger.info(`Loading markdown for node: ${data.label}`);
    setLoadError('');
    
    fetch(data.markdownPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load ${data.markdownPath}: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        setMarkdown(text);
        setLoadError('');
        setIsOrphaned(false);
        logger.info(`Successfully loaded markdown for node: ${data.label}`);
      })
      .catch(error => {
        const errorMessage = `File not found: ${data.markdownPath.split('/').pop()}`;
        setLoadError(errorMessage);
        setMarkdown('');
        setIsOrphaned(true);
        logger.error(`Error loading markdown for ${data.label}`, error as Error);
      });
  }, [data.markdownPath, data.label]);

  useEffect(() => {
    if (markdown && mermaidRef.current) {
      const mermaidMatch = markdown.match(/```mermaid\n([\s\S]*?)\n```/);
      if (mermaidMatch) {
        const mermaidCode = mermaidMatch[1];
        logger.debug(`Rendering mermaid diagram for node: ${data.label}`);
        
        // Generate valid CSS ID (no decimal points)
        const validId = `mermaid-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        mermaid.render(validId, mermaidCode)
          .then(result => {
            if (mermaidRef.current) {
              mermaidRef.current.innerHTML = result.svg;
              
              // Calculate minimum dimensions based on rendered SVG
              setTimeout(() => {
                const svgElement = mermaidRef.current?.querySelector('svg');
                if (svgElement) {
                  const svgRect = svgElement.getBoundingClientRect();
                  const containerPadding = 16; // 8px padding * 2
                  const markdownHeight = 30; // Title only, reduced height
                  
                  const expandedMinWidth = Math.max(200, Math.ceil(svgRect.width) + containerPadding);
                  const expandedMinHeight = Math.max(120, Math.ceil(svgRect.height) + markdownHeight + containerPadding);
                  
                  const newMinDimensions = { 
                    width: expandedMinWidth, 
                    height: expandedMinHeight,
                    collapsedWidth: Math.max(180, expandedMinWidth),
                    collapsedHeight: markdownHeight + containerPadding
                  };
                  setMinDimensions(newMinDimensions);
                  
                  // Update state manager
                  stateManager.updateNodeMinDimensions(id, newMinDimensions);
                  
                  logger.debug(`Updated min dimensions for ${data.label}: ${expandedMinWidth}x${expandedMinHeight} (expanded), ${Math.max(180, expandedMinWidth)}x${markdownHeight + containerPadding} (collapsed)`);
                }
              }, 100); // Small delay to ensure SVG is fully rendered
              
              logger.debug(`Successfully rendered mermaid diagram for node: ${data.label}`);
            }
          })
          .catch(error => {
            logger.error(`Error rendering mermaid diagram for ${data.label}`, error as Error);
          });
      }
    }
  }, [markdown, data.label]);

  // Re-render mermaid when expanding from collapsed state
  useEffect(() => {
    if (!isCollapsed && markdown && mermaidRef.current) {
      const mermaidMatch = markdown.match(/```mermaid\n([\s\S]*?)\n```/);
      if (mermaidMatch && !mermaidRef.current.innerHTML) {
        const mermaidCode = mermaidMatch[1];
        const validId = `mermaid-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        logger.debug(`Re-rendering mermaid diagram for node: ${data.label}`);
        mermaid.render(validId, mermaidCode)
          .then(result => {
            if (mermaidRef.current) {
              mermaidRef.current.innerHTML = result.svg;
              logger.debug(`Successfully re-rendered mermaid diagram for node: ${data.label}`);
            }
          })
          .catch(error => {
            logger.error(`Error re-rendering mermaid diagram for ${data.label}`, error as Error);
          });
      }
    }
  }, [isCollapsed, markdown, data.label]);

  const toggleCollapse = () => {
    try {
      // Use state manager to handle the toggle logic
      const { newSize, isCollapsed: newCollapsedState } = stateManager.toggleNodeCollapse(id);
      
      setIsCollapsed(newCollapsedState);
      logger.logUserAction('toggle_collapse', `Node ${data.label} ${newCollapsedState ? 'collapsed' : 'expanded'}`);
      
      // Update React Flow nodes
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              style: {
                ...node.style,
                width: newSize.width,
                height: newSize.height,
              },
            };
          }
          return node;
        })
      );
    } catch (error) {
      logger.error(`Error toggling collapse for node ${id}`, error as Error);
    }
  };

  // Extract only the title from markdown
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : data.label;

  return (
    <div className={`workflow-node ${isCollapsed ? 'collapsed' : 'expanded'} ${isOrphaned ? 'orphaned' : ''}`}>
      <NodeResizer 
        color="#ff0071" 
        isVisible={selected} 
        minWidth={isCollapsed ? minDimensions.collapsedWidth || 180 : minDimensions.width}
        minHeight={isCollapsed ? minDimensions.collapsedHeight || 50 : minDimensions.height}
      />
      
      {/* Input handles - allow multiple connections */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-main"
        style={{ top: '30%', background: '#4CAF50' }}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-alt"
        style={{ top: '70%', background: '#2196F3' }}
      />
      
      <div className="node-content">
        <div className="markdown-content">
          <h1 onClick={toggleCollapse}>
            <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
            {title}
            {isOrphaned && <span className="orphaned-indicator" title="File not found">⚠️</span>}
          </h1>
        </div>
        
        {!isCollapsed && (
          <>
            {loadError ? (
              <div className="error-content">
                <p className="error-message">{loadError}</p>
                <p className="error-description">The markdown file for this node could not be found.</p>
              </div>
            ) : (
              <div className="mermaid-container" ref={mermaidRef}></div>
            )}
          </>
        )}
      </div>
      
      {/* Output handles - allow multiple connections */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-main"
        style={{ top: '30%', background: '#FF9800' }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-alt"
        style={{ top: '70%', background: '#E91E63' }}
      />
    </div>
  );
};
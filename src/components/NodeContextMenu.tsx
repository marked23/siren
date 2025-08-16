import React from 'react';
import type { Node } from 'reactflow';

interface NodeContextMenuProps {
  node: Node | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onCleanupOrphaned: () => void;
  orphanedCount: number;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  node,
  position,
  onClose,
  onDelete,
  onCleanupOrphaned,
  orphanedCount
}) => {
  if (!node || !position) {
    return null;
  }

  const handleDelete = () => {
    onDelete(node.id);
    onClose();
  };

  const handleCleanupOrphaned = () => {
    onCleanupOrphaned();
    onClose();
  };

  return (
    <div
      className="node-context-menu"
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 1000,
      }}
      onMouseLeave={onClose}
    >
      <div className="context-menu-item delete" onClick={handleDelete}>
        Delete Node
      </div>
      {orphanedCount > 0 && (
        <div className="context-menu-item cleanup" onClick={handleCleanupOrphaned}>
          Cleanup {orphanedCount} Orphaned Node{orphanedCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
import React from 'react';
import type { Edge } from 'reactflow';

interface EdgeContextMenuProps {
  edge: Edge | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onDelete: (edgeId: string) => void;
  onEdit: (edge: Edge) => void;
}

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  edge,
  position,
  onClose,
  onDelete,
  onEdit
}) => {
  if (!edge || !position) {
    return null;
  }

  const handleDelete = () => {
    onDelete(edge.id);
    onClose();
  };

  const handleEdit = () => {
    onEdit(edge);
    onClose();
  };

  return (
    <div
      className="edge-context-menu"
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 1000,
      }}
      onMouseLeave={onClose}
    >
      <div className="context-menu-item" onClick={handleEdit}>
        Edit Label
      </div>
      <div className="context-menu-item delete" onClick={handleDelete}>
        Delete Edge
      </div>
    </div>
  );
};
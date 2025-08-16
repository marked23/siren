import React, { useState } from 'react';
import { stateManager } from '../utils/stateManager';
import { logger } from '../utils/logger';

interface ReEnumerateButtonProps {
  onReEnumerate: (result: { nodes: any[]; edges: any[]; newNodes: number; recoveredNodes: number }) => void;
}

export const ReEnumerateButton: React.FC<ReEnumerateButtonProps> = ({ onReEnumerate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleReEnumerate = async () => {
    setIsLoading(true);
    try {
      logger.info('Re-enumerating markdown files');
      const result = await stateManager.reEnumerateMarkdownFiles();
      onReEnumerate(result);
      logger.logUserAction('re_enumerate_files', `Found ${result.newNodes} new nodes, recovered ${result.recoveredNodes} nodes`);
    } catch (error) {
      logger.error('Failed to re-enumerate markdown files', error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className="re-enumerate-button"
      onClick={handleReEnumerate}
      disabled={isLoading}
      title="Re-scan workflow directory for markdown files"
    >
      {isLoading ? '🔄' : '📁'} {isLoading ? 'Scanning...' : 'Re-scan Files'}
    </button>
  );
};
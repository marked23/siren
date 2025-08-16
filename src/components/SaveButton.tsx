import React, { useState } from 'react';
import { stateManager } from '../utils/stateManager';
import { logger } from '../utils/logger';

export const SaveButton: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      // Get current state and save as workflow config
      const currentState = stateManager.getState();
      await stateManager.saveWorkflowConfig(currentState);
      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      logger.logUserAction('save_workflow', 'User saved workflow config to nodes-and-edges.json');
    } catch (error) {
      logger.error('Failed to save workflow state', error as Error);
      alert('Failed to save workflow state. Check the logs for details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="save-button-container">
      <button 
        onClick={handleSave} 
        disabled={isSaving}
        className="save-button"
      >
        {isSaving ? 'Saving...' : 'Save Workflow'}
      </button>
      {lastSaved && (
        <span className="last-saved">
          Last saved: {lastSaved}
        </span>
      )}
    </div>
  );
};
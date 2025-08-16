import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

function getLogFileName(type) {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `${type}-${date}.log`);
}

function writeLog(type, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  const logFile = getLogFileName(type);
  
  fs.appendFileSync(logFile, logEntry);
}

app.post('/api/log', (req, res) => {
  try {
    const { level, message, timestamp, stack, url, userAgent } = req.body;
    
    const logMessage = JSON.stringify({
      level: level || 'info',
      message,
      timestamp: timestamp || new Date().toISOString(),
      stack,
      url,
      userAgent
    }, null, 2);
    
    writeLog('application', logMessage);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing log:', error);
    res.status(500).json({ error: 'Failed to write log' });
  }
});

app.post('/api/console-log', (req, res) => {
  try {
    const { type, args, timestamp, url } = req.body;
    
    const logMessage = JSON.stringify({
      type: type || 'log',
      args,
      timestamp: timestamp || new Date().toISOString(),
      url
    }, null, 2);
    
    writeLog('console', logMessage);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing console log:', error);
    res.status(500).json({ error: 'Failed to write console log' });
  }
});

app.get('/api/logs/:type', (req, res) => {
  try {
    const { type } = req.params;
    const logFile = getLogFileName(type);
    
    if (fs.existsSync(logFile)) {
      const logs = fs.readFileSync(logFile, 'utf8');
      res.text(logs);
    } else {
      res.text('No logs found for today');
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// Save workflow state to disk
app.post('/api/save-state', (req, res) => {
  try {
    const { filePath, content } = req.body;
    
    if (!filePath || !content) {
      return res.status(400).json({ error: 'Missing filePath or content' });
    }

    // Handle both legacy path and new paths
    let actualFilePath;
    if (filePath.startsWith('./public/workflows/')) {
      // New workflow config path
      actualFilePath = path.join(__dirname, filePath.replace('./', ''));
    } else if (filePath === '/tmp/workflow-state.json') {
      // Legacy state path
      actualFilePath = path.join(__dirname, 'workflow-state.json');
    } else {
      // Default to legacy behavior
      actualFilePath = path.join(__dirname, 'workflow-state.json');
    }
    
    // Ensure directory exists
    const dir = path.dirname(actualFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(actualFilePath, content, 'utf8');
    
    writeLog('application', JSON.stringify({
      level: 'info',
      message: `Workflow state saved to ${actualFilePath}`,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    res.json({ success: true, savedTo: actualFilePath });
  } catch (error) {
    console.error('Error saving state:', error);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// Load workflow state from disk
app.post('/api/load-state', (req, res) => {
  try {
    const { filePath } = req.body;
    
    // Use a local file path relative to the project
    const localFilePath = path.join(__dirname, 'workflow-state.json');
    
    if (!fs.existsSync(localFilePath)) {
      return res.status(404).json({ error: 'State file not found' });
    }
    
    const content = fs.readFileSync(localFilePath, 'utf8');
    const state = JSON.parse(content);
    
    writeLog('application', JSON.stringify({
      level: 'info',
      message: `Workflow state loaded from ${localFilePath}`,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    res.json(state);
  } catch (error) {
    console.error('Error loading state:', error);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

// Enumerate files in a directory
app.post('/api/enumerate-files', (req, res) => {
  try {
    const { directory, extension } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Missing directory parameter' });
    }
    
    const targetDir = path.resolve(__dirname, directory);
    
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const files = fs.readdirSync(targetDir);
    const filteredFiles = extension 
      ? files.filter(file => file.endsWith(extension))
      : files;
    
    writeLog('application', JSON.stringify({
      level: 'info',
      message: `Enumerated ${filteredFiles.length} files in ${directory}`,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    res.json(filteredFiles);
  } catch (error) {
    console.error('Error enumerating files:', error);
    res.status(500).json({ error: 'Failed to enumerate files' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Logging server running on http://0.0.0.0:${port}`);
  console.log(`Access from network: http://<your-ip>:${port}`);
  console.log(`Logs will be written to: ${logDir}`);
});
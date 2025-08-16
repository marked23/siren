# Markdown Workflow Graph Project

## Project Overview
A React application for creating interactive workflow diagrams where each node contains markdown documents with mermaid sequence diagrams. Built with React Flow, this tool allows users to visualize and connect workflow processes in a directed graph format with **automatic markdown file discovery and dynamic node creation**.

## Key Features Implemented

### Core Functionality
- **Interactive Node Graph**: React Flow-based canvas with draggable, resizable nodes
- **Markdown + Mermaid Integration**: Each node displays markdown content with embedded mermaid sequence diagrams
- **Real-time Diagram Rendering**: Dynamic mermaid diagram rendering with proper sizing constraints
- **Collapse/Expand Nodes**: Click node titles to collapse/expand with smooth animations and size memory
- **Automatic File Discovery**: Scans `/public/workflows/` directory for markdown files at startup
- **Dynamic Node Creation**: Automatically creates new nodes for newly discovered markdown files
- **Unified State Management**: Centralized workflow state in `/public/workflows/nodes-and-edges.json`

### Advanced Edge Management
- **Multiple Connection Points**: 4 colored handles per node (input-main/green, input-alt/blue, output-main/orange, output-alt/pink)
- **Multiple Edges Per Anchor**: Support for multiple connections on each handle
- **Smart Edge Styling**: Automatic color coding and labeling based on connection types
- **Edge Deletion**: Delete via keyboard (Delete/Backspace) or right-click context menu
- **Edge Label Editing**: Right-click edges to edit labels with inline prompts
- **Visual Selection**: Selected edges highlighted with hover effects
- **Persistent Edge State**: All edge connections saved and restored automatically

### Workflow Initialization System
- **Markdown File Enumeration**: Automatically discovers all `.md` files in `/public/workflows/`
- **Grid Layout Positioning**: New nodes arranged in 3-column grid with proper spacing
- **Auto-generated Labels**: Filename-to-label conversion (e.g., `user-login.md` → "User Login")
- **Collapsed Initial State**: New nodes start collapsed to minimize visual clutter
- **Incremental Updates**: Only creates nodes for new files, preserves existing configuration
- **Network-aware URLs**: Correctly handles cross-machine development setups

### UI/UX Enhancements
- **Node Resizing**: Individual node resizing with dynamic constraints based on content
- **Overflow Prevention**: Intelligent minimum size calculation to prevent diagram spillover
- **Minimized Padding**: Compact layout with 8px padding and title-only display
- **Save Button**: Persistent storage with last-saved timestamp display, now saving to workflow config
- **Network Accessibility**: Configured for remote browser access
- **Loading States**: Proper loading indicators during async initialization

### Comprehensive Logging System
- **Configurable Log Levels**: Set log level in `logger.ts` (debug/info/warn/error)
- **File-based Logging**: Express server writing structured logs to dated files
- **User Action Tracking**: Detailed logging of resize, move, connect, delete, collapse operations
- **Console Interception**: Captures all console output from remote browsers
- **Network-accessible Logging**: Works with browsers on different machines
- **Log Management**: Clear logs after code changes for clean debugging

## Technical Architecture

### Frontend Stack
- **React 18** with TypeScript
- **React Flow** for interactive diagrams
- **React Markdown** for content rendering  
- **Mermaid.js** for sequence diagrams
- **Vite** for development tooling

### Backend Services
- **Express.js** logging server (port 3001)
- **File enumeration API**: `/api/enumerate-files` endpoint
- **State persistence API**: `/api/save-state` and `/api/load-state` endpoints
- **CORS-enabled** for cross-origin requests

### Key Components
- `WorkflowNode.tsx` - Custom React Flow node with markdown/mermaid rendering
- `EdgeContextMenu.tsx` - Right-click context menu for edge operations
- `SaveButton.tsx` - Workflow config persistence (now saves to nodes-and-edges.json)
- `stateManager.ts` - Centralized state management with workflow initialization
- `logger.ts` - Structured logging utility with configurable levels

## Development Setup

### Install and Run
```bash
npm install

# Option 1: Run both servers together
npm run dev-with-logging

# Option 2: Run servers separately
npm run logging-server  # Start logging server on port 3001
npm run dev             # Start React app on port 5173/5174
```

### Network Configuration
- Vite configured with `host: true` for network access
- Firewall configured for port 5173/5174 external access
- Cross-machine browser testing supported
- Logging server accessible on network IP

### Test Commands
Check package.json or codebase for available lint/typecheck commands:
```bash
npm run build     # Build and typecheck
npm run lint      # If available
npm run typecheck # If available  
npm test         # If available
```

### Log Management
When making code changes that trigger HMR/reloads:
```bash
rm -f logs/*.log  # Clear logs for clean debugging
```

## Workflow Configuration

### File Structure
```
public/workflows/
├── nodes-and-edges.json    # Main workflow configuration
├── user-login.md          # Sample: User authentication flow
├── data-processing.md     # Sample: Data processing pipeline
├── notification-system.md # Sample: Notification workflow
└── test-workflow.md       # Sample: Test workflow (auto-generated)
```

### Configuration Format
The `nodes-and-edges.json` file contains:
- **nodes**: Array of node states with position, size, collapse state, and metadata
- **edges**: Array of edge connections with styling and labels
- **lastSaved**: Timestamp of last save operation
- **version**: Configuration schema version

### Automatic Node Creation
When new `.md` files are added to `/public/workflows/`:
1. Application detects them on startup via file enumeration
2. Creates new nodes with auto-generated IDs and labels
3. Positions them in grid layout starting from existing nodes
4. Sets initial state to collapsed
5. Saves updated configuration automatically

## State Management
- **Node States**: Position, size, collapse state, minimum dimensions, markdown path
- **Edge States**: Connections, labels, colors, handle mappings, selection state
- **Persistence**: JSON file storage at `/public/workflows/nodes-and-edges.json`
- **Initialization**: Async loading with markdown file discovery and node creation
- **Recovery**: Automatic state restoration with fallback handling

## Recent Major Updates
1. ✅ **Workflow Initialization System** - Automatic markdown file discovery and node creation
2. ✅ **Unified Configuration** - Single `nodes-and-edges.json` file for all workflow state
3. ✅ **Grid Layout Engine** - Automatic positioning for new nodes in organized grid
4. ✅ **Network-aware Architecture** - Proper URL handling for cross-machine development
5. ✅ **Configurable Logging** - Adjustable log levels for cleaner debugging
6. ✅ **Save System Overhaul** - SaveButton now saves to workflow config, not legacy state
7. ✅ **Async State Loading** - Proper loading states and error handling
8. ✅ **TypeScript Compliance** - Resolved all build errors and type issues

## File Structure
```
src/
├── components/
│   ├── WorkflowNode.tsx       # Main node component
│   ├── WorkflowNode.css       # Node styling
│   ├── SaveButton.tsx         # Workflow config persistence
│   ├── SaveButton.css         # Save button styling
│   ├── EdgeContextMenu.tsx    # Edge context menu
│   └── EdgeContextMenu.css    # Context menu styling
├── utils/
│   ├── stateManager.ts        # Workflow state management & initialization
│   ├── logger.ts              # Configurable logging utilities
│   └── consoleInterceptor.ts  # Console output capture
├── App.tsx                    # Main application with async initialization
├── App.css                    # Global styles
└── main.tsx                   # React entry point
public/
└── workflows/
    ├── nodes-and-edges.json   # Workflow configuration
    └── *.md                   # Markdown workflow files
logging-server.js              # Express server with file enumeration API
```

## API Endpoints
- `POST /api/enumerate-files` - Discover markdown files in workflow directory
- `POST /api/save-state` - Save workflow configuration to file
- `POST /api/load-state` - Load workflow configuration from file
- `POST /api/log` - Receive application logs from frontend
- `POST /api/console-log` - Receive console output from frontend

## Known Working Features
- ✅ Automatic markdown file discovery and node creation
- ✅ Unified workflow configuration in nodes-and-edges.json
- ✅ Grid layout positioning for new nodes
- ✅ Cross-network development setup
- ✅ Configurable logging levels (set to warn by default)
- ✅ Edge persistence and restoration
- ✅ Node collapse/expand with size memory
- ✅ Real-time mermaid diagram rendering
- ✅ Edge management (create, delete, edit labels)
- ✅ Save/load workflow state persistence
- ✅ TypeScript compilation without errors

## Development Notes
- **Log Level Configuration**: Modify `src/utils/logger.ts:14` to change from 'warn' to 'debug'/'info'/'error'
- **HMR Log Management**: Delete log files after code changes for clean debugging
- **Network Setup**: Use `npm run dev-with-logging` for cross-machine development
- **File Discovery**: Add new `.md` files to `/public/workflows/` and refresh to auto-create nodes

This project successfully implements a comprehensive workflow visualization tool with **automatic content discovery** and **intelligent node management**.
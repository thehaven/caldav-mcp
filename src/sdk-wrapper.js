// Direct module imports with robust error handling
const fs = require('fs');
const path = require('path');

// More reliable module finding function
function findModuleWithoutRequireResolve(modulePath) {
  // Possible locations where the SDK might be installed
  const basePaths = [
    // Local development
    path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk'),
    // NPX installation
    path.resolve(process.cwd(), 'node_modules/@modelcontextprotocol/sdk'),
    // Global installation
    path.resolve(__dirname, '../../@modelcontextprotocol/sdk')
  ];
  
  for (const basePath of basePaths) {
    const fullPath = path.join(basePath, modulePath);
    try {
      // First check if file exists before trying to require it
      if (fs.existsSync(fullPath)) {
        console.log(`Found module at ${fullPath}`);
        return require(fullPath);
      }
    } catch (e) {
      console.log(`Error checking path ${fullPath}: ${e.message}`);
    }
  }
  
  // If we get here, we couldn't find the module
  console.log(`⚠️ Could not find module: ${modulePath}`);
  return createStubImplementation(modulePath);
}

// Create stub implementations if modules can't be found
function createStubImplementation(modulePath) {
  if (modulePath.includes('mcp.js')) {
    return {
      McpServer: class McpServer {
        constructor() { console.log("Using STUB McpServer"); }
        tool() { return this; }
        connect() { return Promise.resolve(); }
      }
    };
  } else if (modulePath.includes('stdio.js')) {
    return {
      StdioServerTransport: class StdioServerTransport {
        constructor() { console.log("Using STUB StdioServerTransport"); }
      }
    };
  }
  return {};
}

// Import the modules using the safer method
const mcpModule = findModuleWithoutRequireResolve('dist/cjs/server/mcp.js');
const stdioModule = findModuleWithoutRequireResolve('dist/cjs/server/stdio.js');

console.log("MCP module exports:", Object.keys(mcpModule));

// Export the SDK classes with the correct capitalization
module.exports = {
  MCPServer: mcpModule.McpServer,
  StdioServerTransport: stdioModule.StdioServerTransport
};
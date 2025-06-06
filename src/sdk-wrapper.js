// Import directly from full file paths to bypass Node.js module resolution
const fs = require('fs');
const path = require('path');

// Get the absolute paths to the required files
const sdkPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk');
const mcpPath = path.join(sdkPath, 'dist/cjs/server/mcp.js');
const stdioPath = path.join(sdkPath, 'dist/cjs/server/stdio.js');

// Import the modules
const mcpModule = require(mcpPath);
const stdioModule = require(stdioPath);

console.log("MCP module exports:", Object.keys(mcpModule));
console.log("McpServer type:", typeof mcpModule.McpServer);

// Export the SDK classes with the correct capitalization
module.exports = {
  // Use the class with the correct capitalization but export with our expected name
  MCPServer: mcpModule.McpServer,
  StdioServerTransport: stdioModule.StdioServerTransport
};
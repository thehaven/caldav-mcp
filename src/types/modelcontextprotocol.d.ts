declare module '@modelcontextprotocol/sdk' {
  export class MCPServer {
    tool(name: string, parameters: any, handler: Function): void;
    connect(transport: any): Promise<void>;
  }
  
  export class StdioServerTransport {
    constructor();
  }
}
// Set production mode consistently on Windows, macOS and Linux.
process.env.NODE_ENV = 'production';
await import('../dist/server/server/index.js');

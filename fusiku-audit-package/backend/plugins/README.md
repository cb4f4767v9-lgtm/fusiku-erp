# FUSIKU ERP Plugins

Phase 10 - Plugin System

Plugins can register:
- **routes** - Express routes mounted at /api/plugins/{pluginName}
- **services** - Background jobs or scheduled tasks

Create a plugin by adding a folder with an `index.ts` that exports:

```ts
export default {
  name: 'my-plugin',
  routes?: (router) => void,
  onLoad?: () => Promise<void>
}
```

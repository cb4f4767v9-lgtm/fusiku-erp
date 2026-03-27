/**
 * Example plugin - demonstrates plugin structure
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Router } from 'express';

export default {
  name: 'example',
  routes(router: Router) {
    router.get('/health', (_, res) => res.json({ plugin: 'example', status: 'ok' }));
  },
  async onLoad() {
    console.log('Example plugin loaded');
  }
};

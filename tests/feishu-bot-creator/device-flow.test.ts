/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeishuDeviceAuth } from '../../skills/feishu-bot-creator/device-flow';

describe('FeishuDeviceAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should be constructible with default options', () => {
    const auth = new FeishuDeviceAuth();
    expect(auth).toBeInstanceOf(FeishuDeviceAuth);
  });

  it('should be constructible with custom env', () => {
    const auth = new FeishuDeviceAuth({ env: 'boe' });
    expect(auth).toBeInstanceOf(FeishuDeviceAuth);
  });

  it('should emit status event during init', async () => {
    const auth = new FeishuDeviceAuth();
    const statuses: string[] = [];
    auth.on('status', (s) => statuses.push(s));

    // Mock the HTTP client
    const mockPost = vi.fn().mockResolvedValue({
      data: { supported_auth_methods: ['client_secret'] },
    });
    (auth as unknown as { client: { post: typeof mockPost } }).client.post = mockPost;

    await auth.init();

    expect(statuses).toContain('正在初始化授权...');
  });

  it('should support EventEmitter event API', () => {
    const auth = new FeishuDeviceAuth();
    const statusHandler = vi.fn();
    const qrcodeHandler = vi.fn();

    auth.on('status', statusHandler);
    auth.on('qrcode', qrcodeHandler);

    auth.emit('status', 'test status');
    auth.emit('qrcode', 'https://example.com/qr');

    expect(statusHandler).toHaveBeenCalledWith('test status');
    expect(qrcodeHandler).toHaveBeenCalledWith('https://example.com/qr');
  });
});
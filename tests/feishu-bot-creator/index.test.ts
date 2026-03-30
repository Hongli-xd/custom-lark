/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  isTriggerMessage,
  shouldIntercept,
  type BotCreatorContext,
} from '../../skills/feishu-bot-creator/index';

// Mock axios for uploadQRCodeImage tests
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('feishu-bot-creator index', () => {
  describe('isTriggerMessage', () => {
    const testCases: [string, boolean][] = [
      ['创建私人机器人', true],
      ['新建私人机器人', true],
      ['创建我的机器人', true],
      ['create private bot', true],
      ['create personal bot', true],
      ['私人机器人', true],
      ['你好', false],
      ['帮我创建一个bot', false],
      ['创建机器人', false],
      ['hello world', false],
      ['', false],
    ];

    testCases.forEach(([input, expected]) => {
      it(`"${input}" => ${expected}`, () => {
        expect(isTriggerMessage(input)).toBe(expected);
      });
    });
  });

  describe('shouldIntercept', () => {
    it('should delegate to isTriggerMessage', () => {
      expect(shouldIntercept('创建私人机器人')).toBe(true);
      expect(shouldIntercept('hello')).toBe(false);
    });
  });
});

describe('BotCreatorContext interface', () => {
  it('should accept valid context objects', () => {
    const ctx: BotCreatorContext = {
      cfg: { test: true },
      accountId: 'acc_1',
      senderOpenId: 'ou_123',
      chatId: 'oc_456',
      chatType: 'p2p',
      messageId: 'om_789',
    };
    expect(ctx.accountId).toBe('acc_1');
  });

  it('should accept group chat type', () => {
    const ctx: BotCreatorContext = {
      cfg: {},
      accountId: 'acc_1',
      senderOpenId: 'ou_123',
      chatId: 'oc_456',
      chatType: 'group',
    };
    expect(ctx.chatType).toBe('group');
  });
});

describe('uploadQRCodeImage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return image_key on successful upload', async () => {
    // Dynamically import to get the function with mocked axios
    const { uploadQRCodeImage } = await import('../../skills/feishu-bot-creator/index');

    mockedAxios.post
      .mockResolvedValueOnce({
        data: { tenant_access_token: 'mock_token' },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { image_key: 'img_uploaded123' } },
      });

    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const result = await uploadQRCodeImage('cli_manager', 'secret_manager', buffer);

    expect(result).toBe('img_uploaded123');
    // Should have called token endpoint then image upload
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('should return null when token request fails', async () => {
    const { uploadQRCodeImage } = await import('../../skills/feishu-bot-creator/index');

    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = await uploadQRCodeImage('cli_manager', 'secret_manager', buffer);

    expect(result).toBeNull();
  });

  it('should return null when token is missing', async () => {
    const { uploadQRCodeImage } = await import('../../skills/feishu-bot-creator/index');

    mockedAxios.post.mockResolvedValueOnce({ data: {} }); // no token

    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = await uploadQRCodeImage('cli_manager', 'secret_manager', buffer);

    expect(result).toBeNull();
  });

  it('should return null when upload returns non-zero code', async () => {
    const { uploadQRCodeImage } = await import('../../skills/feishu-bot-creator/index');

    mockedAxios.post
      .mockResolvedValueOnce({ data: { tenant_access_token: 'mock_token' } })
      .mockResolvedValueOnce({ data: { code: 99999, msg: 'upload failed' } });

    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = await uploadQRCodeImage('cli_manager', 'secret_manager', buffer);

    expect(result).toBeNull();
  });
});


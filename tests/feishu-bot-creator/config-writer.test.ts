/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config.ts before importing config-writer
vi.mock('../../skills/feishu-bot-creator/config', () => ({
  getConfigPath: () => '/tmp/test-openclaw.json',
  getOpenClawDir: () => '/tmp',
  getExtensionsDir: () => '/tmp/extensions',
}));

// Mock fs-extra
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

import * as fs from 'fs';
import {
  readConfig,
  getManagerBotCredentials,
} from '../../skills/feishu-bot-creator/config-writer';

describe('config-writer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('readConfig', () => {
    it('should return empty object if config file does not exist', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));

      const config = await readConfig();
      expect(config).toEqual({});
    });

    it('should return parsed JSON if config file exists', async () => {
      const mockConfig = { channels: { feishu: { appId: 'test' } } };
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await readConfig();
      expect(config).toEqual(mockConfig);
    });
  });

  describe('getManagerBotCredentials', () => {
    it('should return null if no feishu config exists', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));

      const creds = await getManagerBotCredentials();
      expect(creds).toBeNull();
    });

    it('should return credentials from top-level appId/appSecret', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        channels: {
          feishu: {
            appId: 'cli_top_level',
            appSecret: 'secret_top_level',
          },
        },
      }));

      const creds = await getManagerBotCredentials();
      expect(creds).toEqual({
        appId: 'cli_top_level',
        appSecret: 'secret_top_level',
      });
    });

    it('should return credentials from accounts map when no top-level creds', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        channels: {
          feishu: {
            accounts: {
              ou_123: {
                appId: 'cli_account',
                appSecret: 'secret_account',
              },
            },
          },
        },
      }));

      const creds = await getManagerBotCredentials();
      expect(creds).toEqual({
        appId: 'cli_account',
        appSecret: 'secret_account',
      });
    });

    it('should prefer top-level credentials over accounts map', async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        channels: {
          feishu: {
            appId: 'cli_top',
            appSecret: 'secret_top',
            accounts: {
              ou_123: {
                appId: 'cli_account',
                appSecret: 'secret_account',
              },
            },
          },
        },
      }));

      const creds = await getManagerBotCredentials();
      expect(creds).toEqual({
        appId: 'cli_top',
        appSecret: 'secret_top',
      });
    });
  });
});
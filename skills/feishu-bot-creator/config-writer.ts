/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Config writer for feishu-bot-creator skill.
 *
 * Responsible for:
 *   1. Reading current openclaw.json
 *   2. Adding new bot account under channels.feishu.accounts
 *   3. Writing back to disk
 *   4. Signaling OpenClaw to start the new bot
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'path';
import * as fs from 'fs';
import { getConfigPath } from './config';
import type { DeviceAuthResult } from './device-flow';

const execFile = promisify(execFileCb);

const PLUGIN_NAME = 'openclaw-lark';
const PLUGIN_PACKAGE = '@larksuite/openclaw-lark';

interface FeishuChannelConfig {
  enabled?: boolean;
  appId?: string;
  appSecret?: string;
  domain?: string;
  accounts?: Record<string, Record<string, unknown>>;
}

interface OpenClawConfig {
  channels?: {
    feishu?: FeishuChannelConfig;
  };
  plugins?: {
    allow?: string[];
    entries?: Record<string, { enabled?: boolean }>;
  };
}

/** Read and parse openclaw.json */
export async function readConfig(): Promise<Record<string, unknown>> {
  const configPath = getConfigPath();
  try {
    const content = await fs.promises.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/** Write openclaw.json */
export async function writeConfig(config: Record<string, unknown>): Promise<void> {
  const configPath = getConfigPath();
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Read the current feishu config section
 */
export async function getFeishuConfig(): Promise<{
  config: OpenClawConfig;
  feishu: FeishuChannelConfig | undefined;
}> {
  const config = (await readConfig()) as OpenClawConfig;
  return { config, feishu: config.channels?.feishu };
}

/**
 * Get the manager bot's appId and appSecret from openclaw.json
 */
export async function getManagerBotCredentials(): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  const { feishu } = await getFeishuConfig();
  if (!feishu) return null;

  if (feishu.appId && feishu.appSecret) {
    return { appId: feishu.appId as string, appSecret: feishu.appSecret as string };
  }

  if (feishu.accounts) {
    for (const [, account] of Object.entries(feishu.accounts)) {
      if (account.appId && account.appSecret) {
        return { appId: account.appId as string, appSecret: account.appSecret as string };
      }
    }
  }

  return null;
}

/**
 * Write a new bot account to openclaw.json
 */
export async function writeNewBotConfig(result: DeviceAuthResult, ownerOpenId: string): Promise<void> {
  console.log('[feishu-bot-creator] 步骤 [3/4] 读取当前配置...');
  const config = (await readConfig()) as OpenClawConfig;

  if (!config.channels) config.channels = {};
  if (!config.channels.feishu) config.channels.feishu = {};
  const feishu = config.channels.feishu;

  if (!feishu.accounts) feishu.accounts = {};

  const accountId = ownerOpenId || result.userOpenId;
  feishu.accounts[accountId] = {
    enabled: true,
    appId: result.appId,
    appSecret: result.appSecret,
    domain: result.domain,
    dmPolicy: 'allowlist',
    allowFrom: [result.userOpenId],
    groupPolicy: 'allowlist',
    groupAllowFrom: [result.userOpenId],
    groups: { '*': { enabled: true, requireMention: true } },
    connectionMode: 'websocket',
    capabilities: { image: true, audio: true, video: true },
    skills: [],
    historyLimit: 100,
    dmHistoryLimit: 50,
    uat: { enabled: true },
    replyMode: 'auto',
  };

  if (!config.plugins) config.plugins = {};
  if (!config.plugins.allow) config.plugins.allow = [];
  if (!config.plugins.allow.includes(PLUGIN_PACKAGE)) config.plugins.allow.push(PLUGIN_PACKAGE);
  if (!config.plugins.allow.includes(PLUGIN_NAME)) config.plugins.allow.push(PLUGIN_NAME);
  if (!config.plugins.entries) config.plugins.entries = {};
  if (!config.plugins.entries[PLUGIN_NAME]) {
    config.plugins.entries[PLUGIN_NAME] = { enabled: true };
  } else {
    config.plugins.entries[PLUGIN_NAME].enabled = true;
  }

  console.log('[feishu-bot-creator] 步骤 [3/4] 保存配置到 openclaw.json...');
  await writeConfig(config);
}

/**
 * Signal OpenClaw to restart/start the feishu gateway
 */
export async function signalOpenClawRestart(): Promise<void> {
  console.log('[feishu-bot-creator] 步骤 [4/4] 通知 OpenClaw 重启网关...');

  try {
    try {
      const { stdout: installOut } = await execFile('openclaw', ['gateway', 'install']);
      console.log('[feishu-bot-creator] gateway install:', installOut.trim() || '(无输出)');
    } catch {
      console.log('[feishu-bot-creator] gateway install 不支持或已忽略');
    }

    const { stdout: restartOut, stderr: restartErr } = await execFile('openclaw', ['gateway', 'restart']);
    console.log('[feishu-bot-creator] gateway restart:', restartOut.trim() || '(无输出)');
    if (restartErr) {
      console.log('[feishu-bot-creator] gateway restart stderr:', restartErr.trim() || '(无输出)');
    }
    console.log('[feishu-bot-creator] 步骤 [4/4] OpenClaw 网关重启成功');
  } catch (error) {
    console.warn('[feishu-bot-creator] 警告: OpenClaw 网关重启失败，新机器人将在下次启动时生效');
    console.warn('[feishu-bot-creator] 错误:', String(error));
  }
}

/**
 * Full flow: write config and signal restart
 */
export async function finalizeNewBot(result: DeviceAuthResult, ownerOpenId: string): Promise<void> {
  await writeNewBotConfig(result, ownerOpenId);
  await signalOpenClawRestart();
}
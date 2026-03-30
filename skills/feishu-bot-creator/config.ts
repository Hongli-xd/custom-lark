/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Environment URLs and filesystem path helpers for the feishu-bot-creator skill.
 */

import * as path from 'path';
import * as os from 'os';

/** Feishu (China) environment URLs */
export const FEISHU_ENV_URLS: Record<string, string> = {
  prod: 'https://accounts.feishu.cn',
  boe: 'https://accounts.feishu-boe.cn',
  pre: 'https://accounts.feishu-pre.cn',
};

/** Lark (International) environment URLs */
export const LARK_ENV_URLS: Record<string, string> = {
  prod: 'https://accounts.larksuite.com',
  boe: 'https://accounts.larksuite-boe.com',
  pre: 'https://accounts.larksuite-pre.com',
};

/** Get the OpenClaw state directory. */
export function getOpenClawDir(): string {
  return process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), '.openclaw');
}

/** Get the path to openclaw.json config file. */
export function getConfigPath(): string {
  return path.join(getOpenClawDir(), 'openclaw.json');
}

/** Get the extensions directory where plugins are installed. */
export function getExtensionsDir(): string {
  return path.join(getOpenClawDir(), 'extensions');
}
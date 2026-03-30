/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * OAuth Device Flow for creating a new Feishu Personal Agent bot.
 *
 * Reuses the same protocol as openclaw-lark-tools:
 *   POST /oauth/v1/app/registration (action=init/begin/poll)
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { FEISHU_ENV_URLS, LARK_ENV_URLS } from './config';

export interface DeviceAuthResult {
  appId: string;
  appSecret: string;
  userOpenId: string;
  domain: 'feishu' | 'lark';
}

export interface DeviceAuthOptions {
  env?: 'prod' | 'boe' | 'pre';
  lane?: string;
  debug?: boolean;
}

/**
 * OAuth Device Flow for Feishu app registration.
 *
 * Follows RFC 8628-like pattern:
 *   1. init   → Check client_secret auth support
 *   2. begin  → Get device_code + verification_uri
 *   3. poll   → Wait for user authorization
 */
export class FeishuDeviceAuth extends EventEmitter {
  private client: AxiosInstance;
  private baseUrl: string;
  private debug: boolean;

  constructor(options: DeviceAuthOptions = {}) {
    super();
    const env = options.env || 'prod';
    this.debug = !!options.debug;
    this.baseUrl = (FEISHU_ENV_URLS[env] || LARK_ENV_URLS[env]) as string;

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (options.lane) {
      headers['x-tt-env'] = options.lane;
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers,
      timeout: 10000,
    });
  }

  /**
   * Step 1: Init - Check if client_secret auth is supported
   */
  async init(): Promise<{ supported_auth_methods: string[] }> {
    this.emit('status', '正在初始化授权...');
    const response = await this.client.post(
      '/oauth/v1/app/registration',
      new URLSearchParams({ action: 'init' }).toString()
    );
    return response.data;
  }

  /**
   * Step 2: Begin - Start device authorization flow
   */
  async begin(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri_complete: string;
    interval: number;
    expire_in: number;
  }> {
    this.emit('status', '正在发起授权请求...');
    const response = await this.client.post(
      '/oauth/v1/app/registration',
      new URLSearchParams({
        action: 'begin',
        archetype: 'PersonalAgent',
        auth_method: 'client_secret',
        request_user_info: 'open_id',
      }).toString()
    );
    return response.data;
  }

  /**
   * Step 3: Poll - Wait for user to complete authorization
   */
  async poll(deviceCode: string): Promise<{
    client_id?: string;
    client_secret?: string;
    error?: string;
    error_description?: string;
    user_info?: {
      open_id: string;
      tenant_brand?: string;
    };
  }> {
    try {
      const response = await this.client.post(
        '/oauth/v1/app/registration',
        new URLSearchParams({
          action: 'poll',
          device_code: deviceCode,
        }).toString()
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * Switch API domain between Feishu and Lark
   */
  setDomain(isLark: boolean): void {
    const urls = isLark ? LARK_ENV_URLS : FEISHU_ENV_URLS;
    const env = (this.client.defaults.headers['x-tt-env'] as string) || 'prod';
    this.baseUrl = (urls[env as keyof typeof urls] || urls.prod) as string;
    this.client.defaults.baseURL = this.baseUrl;
    this.emit('status', `已切换到 ${isLark ? 'Lark' : 'Feishu'} 域名`);
  }

  /**
   * Full device authorization flow with polling.
   *
   * @param timeoutSecs Maximum wait time (default 600s = 10 min)
   */
  async authorize(timeoutSecs = 600): Promise<DeviceAuthResult> {
    // Step 1: Init
    this.emit('status', '[1/3] 正在初始化授权环境...');
    const initRes = await this.init();

    if (!initRes.supported_auth_methods.includes('client_secret')) {
      throw new Error('当前环境不支持 client_secret 认证方式，请升级 onboard tool');
    }

    // Step 2: Begin
    this.emit('status', '[2/3] 正在获取授权二维码...');
    const beginRes = await this.begin();

    const qrUrl = new URL(beginRes.verification_uri_complete);
    qrUrl.searchParams.set('from', 'bot-creator');
    const qrUrlStr = qrUrl.toString();
    this.emit('qrcode', qrUrlStr);

    const startTime = Date.now();
    let currentInterval = beginRes.interval || 5;
    const expireIn = beginRes.expire_in || timeoutSecs;
    let domainSwitched = false;
    let isLark = false;

    this.emit('status', `[2/3] 请使用飞书扫码授权（${Math.floor(expireIn / 60)}分钟内有效）`);

    // Step 3: Poll
    while (Date.now() - startTime < expireIn * 1000) {
      const pollRes = await this.poll(beginRes.device_code);

      // Check if domain switch is needed
      if (pollRes.user_info?.tenant_brand) {
        isLark = pollRes.user_info.tenant_brand === 'lark';
        if (!domainSwitched && isLark) {
          this.emit('status', '检测到国际版账号，正在切换域名...');
          this.setDomain(true);
          domainSwitched = true;
          continue;
        }
      }

      // Success
      if (pollRes.client_id && pollRes.client_secret) {
        const result: DeviceAuthResult = {
          appId: pollRes.client_id,
          appSecret: pollRes.client_secret,
          userOpenId: pollRes.user_info?.open_id || '',
          domain: isLark ? 'lark' : 'feishu',
        };
        this.emit('status', '授权成功！正在保存配置...');
        this.emit('result', result);
        return result;
      }

      // Error handling
      if (pollRes.error) {
        switch (pollRes.error) {
          case 'authorization_pending':
            break;
          case 'slow_down':
            currentInterval += 5;
            this.emit('status', `授权等待中，请稍候...（已慢速，将延长间隔）`);
            break;
          case 'access_denied':
            throw new Error('用户拒绝授权');
          case 'expired_token':
            throw new Error('授权会话已过期，请重新发起');
          default:
            throw new Error(`${pollRes.error}: ${pollRes.error_description || '未知错误'}`);
        }
      }

      await this.sleep(currentInterval * 1000);
    }

    throw new Error('授权超时，请在有效时间内完成扫码');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Validate app credentials by calling tenant_access_token endpoint
 */
export async function validateAppCredentials(
  appId: string,
  appSecret: string
): Promise<boolean> {
  const cleanAppId = appId?.trim() || '';
  const cleanAppSecret = appSecret?.trim() || '';

  if (!cleanAppId || !cleanAppSecret) {
    return false;
  }

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: cleanAppId,
        app_secret: cleanAppSecret,
      },
      { timeout: 10000 }
    );

    if (response.data?.code === 0 && response.data?.tenant_access_token) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu-bot-creator skill — Create private bots via OAuth Device Flow
 *
 * Intercepts messages containing keywords like "创建私人机器人" and guides
 * the user through the OAuth Device Flow to create a personal Feishu bot.
 */

import axios from 'axios';
import QRCode from 'qrcode';
import { FeishuDeviceAuth } from './device-flow';
import { getManagerBotCredentials, finalizeNewBot } from './config-writer';
import { buildQRCodeCard, buildSuccessCard, buildErrorCard } from './card-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BotCreatorContext {
  cfg: Record<string, unknown>;
  accountId: string;
  senderOpenId: string;
  chatId: string;
  chatType: 'p2p' | 'group';
  messageId?: string;
}

export interface BotCreatorOptions {
  timeoutSecs?: number;
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Keyword patterns
// ---------------------------------------------------------------------------

const CREATE_BOT_PATTERNS = [
  /创建私人机器人/,
  /新建私人机器人/,
  /创建我的机器人/,
  /create.*private.*bot/i,
  /create.*personal.*bot/i,
  /私人机器人/,
];

export function isTriggerMessage(content: string): boolean {
  return CREATE_BOT_PATTERNS.some((pattern) => pattern.test(content));
}

// ---------------------------------------------------------------------------
// Card sending helpers
// ---------------------------------------------------------------------------

async function deliverCard(
  managerAppId: string,
  managerAppSecret: string,
  userOpenId: string,
  chatId: string,
  chatType: 'p2p' | 'group',
  card: Record<string, unknown>
): Promise<string | null> {
  try {
    const tokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: managerAppId, app_secret: managerAppSecret },
      { timeout: 10000 }
    );

    const token = tokenRes.data?.tenant_access_token;
    if (!token) return null;

    let payload: Record<string, unknown>;
    let receiveId: string;
    let receiveIdType: string;

    if (chatType === 'p2p') {
      // P2P: send directly to user's open_id (session already exists since user messaged us)
      receiveId = userOpenId;
      receiveIdType = 'open_id';
      payload = {
        receive_id: receiveId,
        receive_id_type: receiveIdType,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      };
    } else {
      // Group: send to group chat, mentioning the target user so they get notified
      receiveId = chatId;
      receiveIdType = 'chat_id';
      const cardWithMention = injectAtUserIntoCard(card, userOpenId);
      payload = {
        receive_id: receiveId,
        receive_id_type: receiveIdType,
        msg_type: 'interactive',
        content: JSON.stringify(cardWithMention),
      };
    }

    const msgRes = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      payload,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        params: { receive_id_type: receiveIdType },
        timeout: 15000,
      }
    );

    if (msgRes.data?.code === 0) {
      return msgRes.data.data?.message_id || null;
    }
    console.error('[feishu-bot-creator] Send card failed:', msgRes.data);
    return null;
  } catch (error) {
    console.error('[feishu-bot-creator] Send card error:', String(error));
    return null;
  }
}

/**
 * Inject an @user element at the top of a card's elements so the target user
 * gets notified even when the card is sent to a group chat.
 */
function injectAtUserIntoCard(card: Record<string, unknown>, userOpenId: string): Record<string, unknown> {
  const atElement = {
    tag: 'at',
    user_id: userOpenId,
  };
  const elements = [atElement, { tag: 'hr' }, ...(card.elements as unknown[] as Record<string, unknown>[])];
  return { ...card, elements };
}

/**
 * Upload a PNG image buffer to Feishu and return the image_key.
 */
export async function uploadQRCodeImage(
  managerAppId: string,
  managerAppSecret: string,
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const tokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: managerAppId, app_secret: managerAppSecret },
      { timeout: 10000 }
    );

    const token = tokenRes.data?.tenant_access_token;
    if (!token) return null;

    const form = new FormData();
    form.append('image_type', 'message');
    form.append('image', new Blob([Uint8Array.from(imageBuffer)], { type: 'image/png' }), 'qrcode.png');

    const uploadRes = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/images',
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 15000,
      }
    );

    if (uploadRes.data?.code === 0) {
      return uploadRes.data.data?.image_key || null;
    }
    console.error('[feishu-bot-creator] Upload image failed:', uploadRes.data);
    return null;
  } catch (error) {
    console.error('[feishu-bot-creator] Upload image error:', String(error));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleBotCreation(
  ctx: BotCreatorContext,
  options: BotCreatorOptions = {}
): Promise<void> {
  const { timeoutSecs = 600, debug = false } = options;
  const { senderOpenId, chatId, chatType } = ctx;

  console.log('[feishu-bot-creator] 收到创建私人机器人请求');
  console.log('[feishu-bot-creator]   senderOpenId:', senderOpenId);
  console.log('[feishu-bot-creator]   chatId:', chatId);
  console.log('[feishu-bot-creator]   chatType:', chatType);

  try {
    // Step 1: Get manager bot credentials
    console.log('[feishu-bot-creator] 步骤 [1/4] 获取管理机器人凭证...');
    const managerCreds = await getManagerBotCredentials();

    if (!managerCreds) {
      console.error('[feishu-bot-creator] 未找到管理机器人配置');
      return;
    }

    console.log('[feishu-bot-creator] 步骤 [1/4] 成功获取管理机器人凭证');
    console.log('[feishu-bot-creator]   manager appId:', managerCreds.appId);

    // Step 2: Start OAuth Device Flow
    console.log('[feishu-bot-creator] 步骤 [2/4] 发起 OAuth 设备授权流程...');

    const auth = new FeishuDeviceAuth({ env: 'prod', debug });

    auth.on('status', (status) => {
      console.log(`[feishu-bot-creator] OAuth 状态: ${status}`);
    });

    auth.on('qrcode', async (qrUrl) => {
      console.log(`[feishu-bot-creator] 获取到二维码 URL`);
      try {
        // Generate QR code PNG buffer
        const qrBuffer = await QRCode.toBuffer(qrUrl, {
          type: 'png',
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'M',
        });

        // Upload to Feishu and get image_key
        const imageKey = await uploadQRCodeImage(
          managerCreds.appId,
          managerCreds.appSecret,
          qrBuffer
        );

        if (imageKey) {
          const qrCard = buildQRCodeCard(imageKey, qrUrl);
          deliverCard(
            managerCreds.appId,
            managerCreds.appSecret,
            senderOpenId,
            chatId,
            chatType,
            qrCard as Record<string, unknown>
          ).catch(() => {});
        } else {
          // Fallback: send card with URL only
          const qrCard = buildQRCodeCard(qrUrl, qrUrl);
          deliverCard(
            managerCreds.appId,
            managerCreds.appSecret,
            senderOpenId,
            chatId,
            chatType,
            qrCard as Record<string, unknown>
          ).catch(() => {});
        }
      } catch (err) {
        console.error('[feishu-bot-creator] 生成二维码失败:', err);
        // Fallback: send card with URL only
        const qrCard = buildQRCodeCard(qrUrl, qrUrl);
        deliverCard(
          managerCreds.appId,
          managerCreds.appSecret,
          senderOpenId,
          chatId,
          chatType,
          qrCard as Record<string, unknown>
        ).catch(() => {});
      }
    });

    const authResult = await auth.authorize(timeoutSecs);

    console.log('[feishu-bot-creator] 步骤 [2/4] OAuth 授权成功');
    console.log('[feishu-bot-creator]   新机器人 appId:', authResult.appId);
    console.log('[feishu-bot-creator]   新机器人 domain:', authResult.domain);
    console.log('[feishu-bot-creator]   所有者 openId:', authResult.userOpenId);

    // Step 3: Write config and restart gateway
    console.log('[feishu-bot-creator] 步骤 [3/4] 保存新机器人配置...');
    await finalizeNewBot(authResult, senderOpenId);

    // Step 4: Send success card
    console.log('[feishu-bot-creator] 步骤 [4/4] 发送成功通知...');
    const successCard = buildSuccessCard(authResult.appId, authResult.domain, authResult.userOpenId);
    const successMsgId = await deliverCard(
      managerCreds.appId,
      managerCreds.appSecret,
      senderOpenId,
      chatId,
      chatType,
      successCard as Record<string, unknown>
    );

    if (successMsgId) {
      console.log('[feishu-bot-creator] 成功通知已发送:', successMsgId);
    }

    console.log('[feishu-bot-creator] 私人机器人创建流程完成！');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[feishu-bot-creator] 创建失败:', errorMessage);

    try {
      const managerCreds = await getManagerBotCredentials();
      if (managerCreds) {
        const errorCard = buildErrorCard(errorMessage);
        await deliverCard(
          managerCreds.appId,
          managerCreds.appSecret,
          senderOpenId,
          chatId,
          chatType,
          errorCard as Record<string, unknown>
        );
      }
    } catch {
      // best effort
    }
  }
}

// ---------------------------------------------------------------------------
// Integration helper
// ---------------------------------------------------------------------------

/**
 * Check if a message should be intercepted by this skill
 */
export function shouldIntercept(content: string): boolean {
  return isTriggerMessage(content);
}

/**
 * Process a message and handle bot creation if triggered
 * @returns true if the message was handled by this skill (don't dispatch further)
 */
export async function processMessage(
  ctx: BotCreatorContext,
  content: string,
  options?: BotCreatorOptions
): Promise<boolean> {
  if (!shouldIntercept(content)) {
    return false;
  }
  await handleBotCreation(ctx, options);
  return true;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { DeviceAuthResult, DeviceAuthOptions } from './device-flow';
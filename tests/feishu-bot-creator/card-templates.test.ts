/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect } from 'vitest';
import {
  buildQRCodeCard,
  buildSuccessCard,
  buildErrorCard,
  buildIntroCard,
  buildStatusCard,
} from '../../skills/feishu-bot-creator/card-templates';

describe('card-templates', () => {
  describe('buildQRCodeCard', () => {
    it('should render img element when given a Feishu image_key', () => {
      const card = buildQRCodeCard('img_a1b2c3d4e5f6', 'https://example.com/auth', 10);

      expect(card.config?.wide_screen_mode).toBe(true);
      expect(card.header?.title?.content).toBe('🤖 创建私人机器人');
      expect(card.header?.template).toBe('blue');

      // Find the img element
      const imgElement = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'img'
      );
      expect(imgElement).toBeDefined();
      expect((imgElement as any).img_key).toBe('img_a1b2c3d4e5f6');

      // Should NOT have markdown fallback for QR code
      const markdownFallback = card.elements.find(
        (el) =>
          typeof el === 'object' && 'tag' in el && el.tag === 'markdown' &&
          (el as any).content?.includes('扫码链接')
      );
      expect(markdownFallback).toBeUndefined();
    });

    it('should render markdown fallback when given a URL (not an image_key)', () => {
      const url = 'https://example.com/qr?code=abc123';
      const card = buildQRCodeCard(url, url, 10);

      // Should have markdown fallback instead of img
      const markdownFallback = card.elements.find(
        (el) =>
          typeof el === 'object' && 'tag' in el && el.tag === 'markdown' &&
          (el as any).content?.includes('扫码链接')
      );
      expect(markdownFallback).toBeDefined();
      expect((markdownFallback as any).content).toContain(url);

      // Should NOT have img element
      const imgElement = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'img'
      );
      expect(imgElement).toBeUndefined();
    });

    it('should include verification URL in markdown content', () => {
      const qrValue = 'img_test';
      const verificationUrl = 'https://auth.feishu.cn/scan?q=xyz';
      const card = buildQRCodeCard(qrValue, verificationUrl);

      const noteElement = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'note'
      );
      expect(noteElement).toBeDefined();
      expect((noteElement as any).elements[0].content).toContain('10 分钟');

      // Check that waiting message exists
      const waitingElement = card.elements.find(
        (el) =>
          typeof el === 'object' && 'tag' in el && el.tag === 'div'
      );
      expect(waitingElement).toBeDefined();
    });

    it('should use custom expire minutes', () => {
      const card = buildQRCodeCard('img_test', 'https://example.com', 5);

      const noteElement = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'note'
      );
      expect((noteElement as any).elements[0].content).toContain('5 分钟');
    });
  });

  describe('buildSuccessCard', () => {
    it('should render success card with feishu domain', () => {
      const card = buildSuccessCard('cli_abc123', 'feishu', 'ou_user123');

      expect(card.header?.title?.content).toBe('✅ 私人机器人创建成功');
      expect(card.header?.template).toBe('green');

      // App ID and domain info is inside a div > markdown
      const divWithInfo = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'div'
      ) as any;
      const contentMarkdown = divWithInfo?.elements?.find(
        (e: any) => e.tag === 'markdown'
      ) as any;
      expect(contentMarkdown?.content).toContain('cli_abc123');
      expect(contentMarkdown?.content).toContain('飞书国内版');
      expect(contentMarkdown?.content).toContain('ou_user123');
    });

    it('should render success card with lark domain', () => {
      const card = buildSuccessCard('cli_xyz', 'lark', 'ou_larkuser');

      const divWithInfo = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'div'
      ) as any;
      const contentMarkdown = divWithInfo?.elements?.find(
        (e: any) => e.tag === 'markdown'
      ) as any;
      expect(contentMarkdown?.content).toContain('Lark 国际版');
    });
  });

  describe('buildErrorCard', () => {
    it('should render error card with message', () => {
      const card = buildErrorCard('授权已过期');

      expect(card.header?.title?.content).toBe('❌ 创建失败');
      expect(card.header?.template).toBe('red');

      const content = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'div'
      ) as any;
      expect(content.elements[0].content).toContain('授权已过期');
    });
  });

  describe('buildIntroCard', () => {
    it('should render intro card', () => {
      const card = buildIntroCard();

      expect(card.header?.title?.content).toBe('🤖 创建私人机器人');
      expect(card.header?.template).toBe('blue');

      const elements = card.elements.filter(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'markdown'
      ) as any[];
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('buildStatusCard', () => {
    it('should render status card with given status', () => {
      const card = buildStatusCard('正在扫码授权...');

      expect(card.header?.title?.content).toBe('🤖 创建私人机器人');
      expect(card.header?.template).toBe('blue');

      const content = card.elements.find(
        (el) => typeof el === 'object' && 'tag' in el && el.tag === 'div'
      ) as any;
      expect(content.elements[0].content).toBe('正在扫码授权...');
    });
  });
});

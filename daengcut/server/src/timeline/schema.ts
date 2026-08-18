import { z } from 'zod';
import { TIMELINE_VERSION } from './types.js';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 형식이어야 합니다');

export const framingSchema = z.object({
  mode: z.enum(['cover', 'blur', 'contain']),
  offsetX: z.number().min(-1).max(1),
  offsetY: z.number().min(-1).max(1),
  zoom: z.number().min(1).max(3),
});

export const clipSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    in: z.number().min(0),
    out: z.number().min(0),
    speed: z.number().min(0.25).max(4),
    framing: framingSchema,
    volume: z.number().min(0).max(2),
  })
  .refine((c) => c.out > c.in, { message: '클립의 끝은 시작보다 뒤여야 합니다' });

export const captionSchema = z
  .object({
    id: z.string().min(1),
    start: z.number().min(0),
    end: z.number().min(0),
    text: z.string().max(200),
    emphasis: z.boolean(),
  })
  .refine((c) => c.end > c.start, { message: '자막의 끝은 시작보다 뒤여야 합니다' });

export const narrationSchema = z.object({
  id: z.string().min(1),
  start: z.number().min(0),
  text: z.string().max(500),
  audioFile: z.string().nullable(),
  durationSec: z.number().positive().nullable(),
  voice: z.string().nullable(),
});

export const captionStyleSchema = z.object({
  fontFamily: z.string().max(80),
  fontSizeRatio: z.number().min(0.02).max(0.12),
  color: hexColor,
  outlineColor: hexColor,
  outlineWidth: z.number().min(0).max(20),
  shadow: z.number().min(0).max(10),
  bold: z.boolean(),
  position: z.enum(['top', 'middle', 'bottom']),
  marginRatio: z.number().min(0).max(0.45),
  boxColor: hexColor.nullable(),
  boxOpacity: z.number().min(0).max(1),
  maxCharsPerLine: z.number().int().min(6).max(40),
});

export const musicSchema = z.object({
  file: z.string().min(1),
  gain: z.number().min(0).max(1),
  fadeInSec: z.number().min(0).max(10),
  fadeOutSec: z.number().min(0).max(10),
});

export const timelineSchema = z.object({
  version: z.literal(TIMELINE_VERSION),
  canvas: z.object({
    width: z.number().int().min(240).max(3840),
    height: z.number().int().min(240).max(3840),
    fps: z.number().min(15).max(60),
  }),
  clips: z.array(clipSchema).min(1, '클립이 최소 하나는 있어야 합니다'),
  captions: z.array(captionSchema),
  narration: z.array(narrationSchema),
  music: musicSchema.nullable(),
  duckRatio: z.number().min(0).max(1),
  style: captionStyleSchema,
  meta: z.object({
    title: z.string().max(100),
    description: z.string().max(5000),
    tags: z.array(z.string().max(40)).max(30),
  }),
});

export type TimelineInput = z.infer<typeof timelineSchema>;

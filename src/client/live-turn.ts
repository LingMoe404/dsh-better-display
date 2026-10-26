import type { AssistantChatData, ChatConversationViewNode } from '@deepseek-ai/dsh-client-ui-chat/client';
import type { AssistantBlock } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { assistantSegments, hasVisibleBody } from './projection.js';
import type { TurnBoundary } from './projection.js';
import type { ReaderFlowEntry, ToolActivityEntry } from './tool-activity.js';

export type LiveStep =
  | { kind: 'reasoning'; key: string; nodeKey: string; start: number; blocks: AssistantBlock[]; step: number }
  | { kind: 'body'; key: string; nodeKey: string; start: number; blocks: AssistantBlock[]; step: number }
  | { kind: 'tool'; key: string; entry: ToolActivityEntry }
  | { kind: 'user'; key: string; nodeKey: string }
  | { kind: 'other'; key: string; nodeKey: string };

export type LiveTurnItem =
  | { kind: 'user'; key: string; step: Extract<LiveStep, { kind: 'user' }> }
  | { kind: 'fold'; key: string; steps: readonly LiveStep[]; summary: string }
  | { kind: 'open'; key: string; step: LiveStep };

export function liveFoldEnabled(boundary: TurnBoundary): boolean {
  return boundary.status === 'open';
}

export function foldSummary(steps: readonly LiveStep[]): string {
  let reasoning = 0;
  let body = 0;
  let tool = 0;
  let extra = 0;
  for (const step of steps) {
    if (step.kind === 'reasoning') reasoning += 1;
    else if (step.kind === 'body') body += 1;
    else if (step.kind === 'tool') tool += 1;
    else if (step.kind !== 'user') extra += 1;
  }
  const parts: string[] = [];
  if (reasoning) parts.push(`思考×${reasoning}`);
  if (body) parts.push(`输出×${body}`);
  if (tool) parts.push(`工具×${tool}`);
  if (extra) parts.push(`记录×${extra}`);
  return parts.join(' · ') || '此前步骤';
}

function skipReasoning(part: { kind: string; blocks: AssistantBlock[] }): boolean {
  return part.kind === 'reasoning' && !part.blocks.some(block => block.kind === 'reasoning' && block.text.trim() !== '');
}

function skipBody(part: { kind: string; blocks: AssistantBlock[] }): boolean {
  return part.kind === 'body' && !hasVisibleBody(part.blocks);
}

function stepsFromAssistant(
  nodeKey: string,
  data: AssistantChatData,
  toolsByCallId: Map<string, ToolActivityEntry>,
  consumed: Set<string>,
): LiveStep[] {
  const marks: { at: number; step: LiveStep }[] = [];
  for (const part of assistantSegments(data.blocks)) {
    if (skipReasoning(part) || skipBody(part)) continue;
    marks.push({
      at: part.start,
      step: {
        kind: part.kind,
        key: `${nodeKey}:${part.kind}:${part.start}`,
        nodeKey,
        start: part.start,
        blocks: part.blocks,
        step: data.step,
      },
    });
  }
  data.blocks.forEach((block, index) => {
    if (block.kind !== 'tool-call' || !block.callId) return;
    const tool = toolsByCallId.get(block.callId);
    if (!tool || consumed.has(tool.callId)) return;
    consumed.add(tool.callId);
    marks.push({ at: index, step: { kind: 'tool', key: tool.key, entry: tool } });
  });
  marks.sort((left, right) => left.at - right.at || left.step.key.localeCompare(right.step.key));
  return marks.map(mark => mark.step);
}

/** Expand readerFlow into source-ordered live steps using existing block boundaries. */
export function segmentLiveTurn(
  flow: readonly ReaderFlowEntry[],
  get: (key: string) => ChatConversationViewNode | undefined,
): LiveStep[] {
  const steps: LiveStep[] = [];
  const consumed = new Set<string>();
  const toolsByCallId = new Map<string, ToolActivityEntry>();
  for (const entry of flow) {
    if (entry.kind === 'tool') toolsByCallId.set(entry.callId, entry);
  }
  for (const entry of flow) {
    if (entry.kind === 'tool') {
      if (!consumed.has(entry.callId)) {
        steps.push({ kind: 'tool', key: entry.key, entry });
        consumed.add(entry.callId);
      }
      continue;
    }
    const node = get(entry.nodeKey);
    if (!node || node.visibility === 'hidden' || node.kind === 'turn-tail') continue;
    if (node.kind === 'user' || node.kind === 'steering') {
      steps.push({ kind: 'user', key: entry.key, nodeKey: entry.nodeKey });
      continue;
    }
    if (node.kind === 'assistant-step') {
      steps.push(...stepsFromAssistant(entry.nodeKey, node.data as AssistantChatData, toolsByCallId, consumed));
      continue;
    }
    steps.push({ kind: 'other', key: entry.key, nodeKey: entry.nodeKey });
  }
  return steps;
}

/** Only a run that contains real thinking/tool work is worth folding. */
function foldableRun(run: readonly LiveStep[]): boolean {
  return run.some(step => step.kind === 'reasoning' || step.kind === 'tool');
}

/**
 * One live chain: narration stays visible, while every earlier reasoning/tool
 * run collapses into its own box at its original position.
 */
export function presentLiveTurn(steps: readonly LiveStep[], boundary: TurnBoundary, autoFold = true): LiveTurnItem[] {
  const live = autoFold && liveFoldEnabled(boundary);
  const items: LiveTurnItem[] = [];
  const open = (step: LiveStep) => items.push({ kind: 'open', key: step.key, step });
  const fold = (run: readonly LiveStep[]) => {
    if (!run.length) return;
    if (live && foldableRun(run)) {
      items.push({ kind: 'fold', key: `live-fold:${run[0]!.key}`, steps: run, summary: foldSummary(run) });
    } else {
      for (const step of run) open(step);
    }
  };
  let run: LiveStep[] = [];
  const flush = () => { fold(run); run = []; };

  // A user insert resets the chain: steps before it are never folded by
  // reasoning after it. Split into user-delimited segments and walk each one.
  const segments: LiveStep[][] = [];
  let segment: LiveStep[] = [];
  for (const step of steps) {
    if (step.kind === 'user') {
      segments.push(segment); segments.push([step]); segment = [];
    } else {
      segment.push(step);
    }
  }
  segments.push(segment);

  for (const part of segments) {
    if (!part.length) continue;
    const first = part[0]!;
    if (part.length === 1 && first.kind === 'user') {
      items.push({ kind: 'user', key: first.key, step: first });
      continue;
    }
    if (!live) {
      for (const step of part) open(step);
      continue;
    }
    // Narration is never folded. Once a later reasoning step exists, every
    // reasoning/tool run before it folds at its own position, so the latest
    // thinking and everything after it stay open while earlier steps collapse —
    // even across narration blocks, which the reader still renders in place.
    const lastReasoning = part.findLastIndex(step => step.kind === 'reasoning');
    if (lastReasoning <= 0) {
      for (const step of part) open(step);
      continue;
    }
    for (let index = 0; index < part.length; index++) {
      const step = part[index]!;
      if (index < lastReasoning) {
        if (step.kind === 'body') { flush(); open(step); }
        else run.push(step);
      } else {
        if (index === lastReasoning) flush();
        open(step);
      }
    }
    flush();
  }
  return items;
}

/**
 * Summaries for collapsed process that sits between two narration blocks.
 *
 * A live-fold cell already shows that summary while the turn is open. Drawing
 * the seam as well repeats the same counts, so a run whose every step is
 * already inside a fold cell contributes neither a seam nor `after`. `after`
 * is what marks the previous body with `data-reader-seam-after` and drops its
 * bottom padding; skipping the seam must leave that spacing alone.
 */
export function planProcessSeams(
  steps: readonly LiveStep[],
  liveItems: readonly LiveTurnItem[],
  expanded: boolean,
): { before: Map<string, string>; after: Set<string> } {
  const before = new Map<string, string>();
  const after = new Set<string>();
  if (expanded) return { before, after };
  const liveFolded = new Set(
    liveItems.flatMap(item => item.kind === 'fold' ? item.steps.map(step => step.key) : []),
  );
  let previousBody: Extract<LiveStep, { kind: 'body' }> | undefined;
  let process: LiveStep[] = [];
  for (const step of steps) {
    if (step.kind === 'body') {
      const folded = process.filter(item => item.kind !== 'user');
      const coveredByLiveFold = folded.length > 0 && folded.every(item => liveFolded.has(item.key));
      if (!coveredByLiveFold && previousBody
        && folded.some(item => item.kind === 'reasoning' || item.kind === 'tool' || item.kind === 'other')) {
        before.set(step.key, foldSummary(folded));
        after.add(previousBody.key);
      }
      previousBody = step;
      process = [];
    } else if (step.kind === 'user') {
      previousBody = undefined;
      process = [];
    } else {
      process.push(step);
    }
  }
  return { before, after };
}

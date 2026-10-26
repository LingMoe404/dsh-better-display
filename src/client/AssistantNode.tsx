import { memo } from 'react';
import type { RefObject } from 'react';
import type { ChatConversationViewNode, ChatNode, ChatNodeKind } from '@deepseek-ai/dsh-client-ui-chat/client';
import { Blocks, CopyAnswer } from './Blocks.js';
import { ReasoningCard } from './ReasoningCard.js';
import { OfficialActions, OfficialAssistantBody } from './OfficialContent.js';
import { ProcessFragment, RetiringContent } from './motion.js';
import { assistantSegments, forkAnchorSeq, hasVisibleBody, isEarlierNarration } from './projection.js';
import type { TurnBoundary } from './projection.js';
import type { BlockRenderProps, ReaderProps } from './types.js';
import css from './Reader.module.css';

function isNode<K extends ChatNodeKind>(node: ChatConversationViewNode, kind: K): node is ChatNode<K> {
  return node.kind === kind;
}

type SeatProps = BlockRenderProps & Pick<ReaderProps, 'useChat' | 'sessionId'> & {
  nodeKey: string; boundary: TurnBoundary; pinned?: boolean; processOpen?: boolean;
};

export const AssistantNode = memo(function AssistantNode({ useChat, nodeKey, boundary, processOpen = false, pinned = false, folded = false, partStart, motion, onRead, returnFocusTo, ...render }: SeatProps & {
  motion: boolean; onRead: () => void; returnFocusTo: RefObject<HTMLButtonElement>; partStart?: number; folded?: boolean;
}) {
  const node = useChat(snapshot => snapshot.nodes.get(nodeKey));
  if (!node || node.visibility === 'hidden' || !isNode(node, 'assistant-step')) return null;
  const data = node.data;
  const parts = assistantSegments(data.blocks);
  const earlier = isEarlierNarration(data, boundary);
  const hasToolCalls = data.blocks.some(block => block.kind === 'tool-call');
  const isProcessStep = earlier || folded || hasToolCalls || (boundary.latestStep > 0 && data.step < boundary.latestStep);
  const body = data.blocks.filter(block => block.kind !== 'reasoning' && block.kind !== 'tool-call');
  const visible = partStart === undefined ? parts : parts.filter(part => part.start === partStart);
  const bodyProps = { streaming: data.status === 'running', holdFormatting: pinned, startedAt: data.time, interrupted: data.status === 'interrupted', liveText: true as const };
  return <>{visible.map(part => {
    const index = parts.findIndex(item => item.start === part.start);
    const last = index === parts.length - 1;
    return part.kind === 'reasoning'
    ? <ProcessFragment key={part.start} open={processOpen} motion={motion} onRead={onRead} returnFocusTo={returnFocusTo} nodeKey={nodeKey} framed>
      <ReasoningCard step={data.step} active={processOpen && boundary.status === 'open' && data.step === boundary.latestStep} motion={motion} selected={pinned} onRead={onRead}>
        <Blocks {...render} blocks={part.blocks} streaming={data.status === 'running' && last && data.blocks.at(-1)?.kind === 'reasoning'}
          holdFormatting={pinned} startedAt={data.time} interrupted={data.status === 'interrupted'} liveText />
      </ReasoningCard>
    </ProcessFragment>
    : isProcessStep ? <ProcessFragment key={part.start} open={processOpen} motion={motion} onRead={onRead} returnFocusTo={returnFocusTo} nodeKey={nodeKey}>
      <article className={css.processCommentary}>
        <OfficialAssistantBody {...render} node={node} blocks={part.blocks} {...bodyProps} />
      </article>
    </ProcessFragment>
    : hasVisibleBody(part.blocks) && <RetiringContent key={part.start} visible={pinned || processOpen || (!earlier && !folded)}>
      <article className={css.answer} data-reader-answer data-reader-anchor data-reader-key={nodeKey} data-reader-source-start={part.start} data-answer-status={data.status} data-answer-phase={earlier || folded ? 'process' : 'body'}>
        <OfficialAssistantBody {...render} node={node} blocks={part.blocks} {...bodyProps} />
        {last && data.status === 'interrupted' && <span className={css.stopped}>已停止</span>}
        {last && !earlier && !folded && data.status !== 'running' && boundary.status === 'closed' && (
          <CopyAnswer blocks={body} onFork={(() => {
            // The fork anchor must be the durable closing message seq (same as
            // the official turn-tail branch). AssistantChatData carries no seq
            // of its own; passing it would fork the whole session instead.
            const anchor = forkAnchorSeq([data.finalNode, { seq: render.forkSeq }]);
            return render.forkAt && anchor !== undefined ? () => render.forkAt!(anchor) : undefined;
          })()} metrics={render.metrics} extraActions={<OfficialActions official={render.official} messageId={data.finalNode?.messageId} />} />
        )}
      </article>
    </RetiringContent>;
  })}</>;
});

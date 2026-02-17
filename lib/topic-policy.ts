import { TopicStatus } from "@prisma/client";

const PARTICIPATION_ALLOWED_STATUSES: TopicStatus[] = ["OPEN"];

export function getParticipationBlockReason(topic: { status: TopicStatus; closeAt: Date }, now = new Date()): string | null {
  if (!PARTICIPATION_ALLOWED_STATUSES.includes(topic.status)) {
    return `Topic is not open for participation (status: ${topic.status})`;
  }

  if (topic.closeAt.getTime() <= now.getTime()) {
    return "Topic participation is closed";
  }

  return null;
}

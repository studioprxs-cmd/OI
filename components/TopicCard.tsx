import { parseTopicKindFromTitle } from "@/lib/topic";

import { FeedCard } from "./FeedCard";
import { Pill } from "./ui";

type TopicCardProps = {
  title: string;
  description: string;
};

export function TopicCard({ title, description }: TopicCardProps) {
  const kind = parseTopicKindFromTitle(title);

  return (
    <FeedCard
      title={title}
      description={description}
      badge={<Pill tone={kind === "BETTING" ? "success" : "neutral"}>{kind}</Pill>}
    />
  );
}

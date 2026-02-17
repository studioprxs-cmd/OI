import { parseTopicKindFromTitle } from "@/lib/topic";

const TOPIC_BANNERS: Record<string, string> = {
  "winter-shorttrack-kim-gilli-final": "/topic-banners/winter-shorttrack-kim-gilli-final.png",
  "winter-speedskating-massstart": "/topic-banners/winter-speedskating-massstart.png",
  "winter-figure-womens-single": "/topic-banners/winter-figure-womens-single.png",
  "winter-curling-team-kor": "/topic-banners/winter-curling-team-kor.png",
};

export function getTopicThumbnail(id: string, title: string) {
  const direct = TOPIC_BANNERS[id];
  if (direct) return direct;

  const kind = parseTopicKindFromTitle(title);
  return kind === "BETTING"
    ? "/topic-banners/winter-speedskating-massstart.png"
    : "/topic-banners/winter-figure-womens-single.png";
}

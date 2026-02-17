import { parseTopicKindFromTitle } from "@/lib/topic";

const TOPIC_BANNERS: Record<string, string> = {
  "news-osaka-dotombori-stabbing": "/topic-banners/news-osaka-dotombori-stabbing.png",
  "news-multihome-tax-benefit-debate": "/topic-banners/news-multihome-tax-benefit-debate.png",
  "news-gangwon-heavy-snow": "/topic-banners/news-gangwon-heavy-snow.png",
  "news-highway-wrongway-crash": "/topic-banners/news-highway-wrongway-crash.png",
  "news-housing-gap-nohome": "/topic-banners/news-housing-gap-nohome.png",
  "news-bts-concert-room-price": "/topic-banners/news-bts-concert-room-price.png",
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

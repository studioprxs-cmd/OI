import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

type LocalComment = {
  id: string;
  topicId: string;
  userId: string;
  content: string;
  createdAt: string;
};

type LocalVote = {
  id: string;
  topicId: string;
  userId: string;
  choice: "YES" | "NO";
  createdAt: string;
};

type LocalBet = {
  id: string;
  topicId: string;
  userId: string;
  choice: "YES" | "NO";
  amount: number;
  settled: boolean;
  payoutAmount: number | null;
  createdAt: string;
};

type LocalTopicInteractions = {
  comments: LocalComment[];
  votes: LocalVote[];
  bets: LocalBet[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "topic-interactions.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: LocalTopicInteractions = { comments: [], votes: [], bets: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readData(): Promise<LocalTopicInteractions> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as LocalTopicInteractions;
    return {
      comments: parsed.comments ?? [],
      votes: parsed.votes ?? [],
      bets: parsed.bets ?? [],
    };
  } catch {
    return { comments: [], votes: [], bets: [] };
  }
}

async function writeData(data: LocalTopicInteractions) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function getLocalTopicInteractions(topicId: string) {
  const data = await readData();
  return {
    comments: data.comments.filter((comment) => comment.topicId === topicId),
    votes: data.votes.filter((vote) => vote.topicId === topicId),
    bets: data.bets.filter((bet) => bet.topicId === topicId),
  };
}

export async function addLocalComment(input: { topicId: string; userId: string; content: string }) {
  const data = await readData();
  const comment: LocalComment = {
    id: randomUUID(),
    topicId: input.topicId,
    userId: input.userId,
    content: input.content,
    createdAt: new Date().toISOString(),
  };

  data.comments.push(comment);
  await writeData(data);
  return comment;
}

export async function addLocalVote(input: { topicId: string; userId: string; choice: "YES" | "NO" }) {
  const data = await readData();
  const exists = data.votes.find((vote) => vote.topicId === input.topicId && vote.userId === input.userId);
  if (exists) {
    throw new Error("LOCAL_VOTE_ALREADY_EXISTS");
  }

  const vote: LocalVote = {
    id: randomUUID(),
    topicId: input.topicId,
    userId: input.userId,
    choice: input.choice,
    createdAt: new Date().toISOString(),
  };

  data.votes.push(vote);
  await writeData(data);
  return vote;
}

export async function removeLocalVoteById(voteId: string) {
  const data = await readData();
  const nextVotes = data.votes.filter((vote) => vote.id !== voteId);

  if (nextVotes.length === data.votes.length) {
    return false;
  }

  data.votes = nextVotes;
  await writeData(data);
  return true;
}

export async function addLocalBet(input: { topicId: string; userId: string; choice: "YES" | "NO"; amount: number }) {
  const data = await readData();
  const bet: LocalBet = {
    id: randomUUID(),
    topicId: input.topicId,
    userId: input.userId,
    choice: input.choice,
    amount: input.amount,
    settled: false,
    payoutAmount: null,
    createdAt: new Date().toISOString(),
  };

  data.bets.push(bet);
  await writeData(data);
  return bet;
}

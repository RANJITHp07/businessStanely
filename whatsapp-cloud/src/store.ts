import { MongoClient, type Collection, type Db } from "mongodb";

// Cloud API has no "fetch my chats" endpoint: everything the admin panel shows
// is what we have received by webhook (incoming messages, phone echoes,
// history sync) or sent ourselves, so it all lives in MongoDB.

export type CloudConfigDoc = {
  _id: "default";
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  connectedAt: Date;
  historySyncRequestedAt?: Date | null;
};

export type CloudChatDoc = {
  _id: string; // customer wa_id (digits only), or "<group_id>@g.us" for groups
  profileName?: string | null; // name the customer set on WhatsApp (group subject for groups)
  contactName?: string | null; // name saved in the phone's address book
  lastMessage?: string;
  timestamp?: number | null; // ms
  unreadCount?: number;
  lastInboundAt?: number | null; // ms, drives the 24h customer service window
};

export type CloudContactDoc = {
  _id: string; // wa_id / phone digits
  name: string;
  updatedAt: Date;
};

export type CloudMessageDoc = {
  _id: string; // wamid
  chatId: string; // wa_id digits, or "<group_id>@g.us"
  body: string;
  timestamp: number; // ms
  fromMe: boolean;
  author?: string | null; // group messages: sender's display name
  authorId?: string | null; // group messages from the groups bridge: sender JID (for read receipts/quotes)
  type: string;
  ack: number;
  error?: string | null;
  media?: {
    id?: string | null;
    mimetype?: string | null;
    filename?: string | null;
    localFile?: string | null;
    s3Key?: string | null;
  } | null;
  quotedMessageId?: string | null;
  quotedMessageBody?: string | null;
  quotedMessageAuthor?: string | null;
  // "web" = live group message from the whatsapp-groups bridge (linked device).
  source: "webhook" | "echo" | "history" | "api" | "web";
};

type Collections = {
  config: Collection<CloudConfigDoc>;
  chats: Collection<CloudChatDoc>;
  contacts: Collection<CloudContactDoc>;
  messages: Collection<CloudMessageDoc>;
};

let connecting: Promise<Collections> | null = null;

export function getCollections(): Promise<Collections> {
  if (connecting) return connecting;

  const uri = process.env.WHATSAPP_MONGODB_URI?.trim();
  if (!uri) {
    return Promise.reject(
      new Error("WHATSAPP_MONGODB_URI is not set. The Cloud API provider needs MongoDB."),
    );
  }

  connecting = (async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const db: Db = client.db(process.env.WHATSAPP_MONGODB_DB?.trim() || undefined);
    const collections: Collections = {
      config: db.collection<CloudConfigDoc>("whatsapp_cloud_config"),
      chats: db.collection<CloudChatDoc>("whatsapp_cloud_chats"),
      contacts: db.collection<CloudContactDoc>("whatsapp_cloud_contacts"),
      messages: db.collection<CloudMessageDoc>("whatsapp_cloud_messages"),
    };
    await Promise.all([
      collections.messages.createIndex({ chatId: 1, timestamp: -1 }),
      collections.chats.createIndex({ timestamp: -1 }),
    ]);
    return collections;
  })().catch((error) => {
    connecting = null;
    throw error;
  });

  return connecting;
}

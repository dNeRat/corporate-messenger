export type Profile = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export type User = {
  id: number;
  email: string;
  presenceStatus?: "ONLINE" | "OFFLINE";
  lastSeenAt?: string | null;
  profile?: Profile | null;
};

export type MessagePreview = {
  id: number;
  text: string;
  createdAt: string;
};

export type Chat = {
  id: number;
  title?: string | null;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  companion?: User | null;     // direct
  members?: any[];             
  messages: MessagePreview[];  // lastMessage = messages[0]
};

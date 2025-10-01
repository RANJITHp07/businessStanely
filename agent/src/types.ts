export interface TaskCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  status: "pending" | "approved";
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByType?: "user" | "agent" | null;
  createdByRole?: "owner" | "admin" | null;
  createdById: string | null;
  approvedById?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  taskCount?: number;
  isOwner?: boolean;
  photo?: string;
  createdByUser?: {
    id: string;
    username: string;
    email: string;
  };
  createdByAgent?: {
    id: string;
    name: string;
    email: string;
  };
}
export interface Agent {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  secondaryPhoneNumber: string | null;
  agentType: string;
  barAssociationId: string;
  jurisdiction: string;
  specializations: string[];
  photo: string | null;
  superior: Agent | null;
  subordinates: Agent[];
}

export interface Client {
  id: string;
  clientType: string;
  email: string;
  phoneNumber: string;
  secondaryPhoneNumber: string | null;
  address: string | null;
  preferredCommunication: string | null;
  notes: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  organizationName: string | null;
  registrationNumber: string | null;
  entityType: string | null;
  incorporationDate: string | null;
  gstNumber: string | null;
  authorizedPersonName: string | null;
  designation: string | null;
  contactEmail: string | null;
  name?: string; // Added for API compatibility
  getDisplayName(): string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  progress?: number;
  followUpRequired?: boolean;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  createdBy: Agent;
  assignedTo?: Agent;
  category?: {
    id: string;
    name: string;
    description?: string;
    color: string;
    status: string;
  };
  comments?: Comment[];
  legislationId?: string; // Added to link tasks to legislations
  legislation?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }; // Added legislation object to include detailed information
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  taskId: string;
  authorId: string;
  authorType: "USER" | "AGENT";
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentSize?: number;
  attachmentType?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  agent?: {
    id: string;
    name: string;
    email: string;
    photo?: string;
  };
}

export interface Retainership {
  id: string;
  name: string;
  description?: string;
  color: string;
  status: "pending" | "approved";
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByType?: "user" | "agent" | null;
  createdByRole?: "owner" | "admin" | null;
  createdById: string | null;
  approvedById?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  taskCount?: number;
  isOwner?: boolean;
  photo?: string;
  legislation: {
    id: string;
    title: string;
    description?: string;
    assignedAgent?: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  createdByUser?: {
    id: string;
    username: string;
    email: string;
  };
  createdByAgent?: {
    id: string;
    name: string;
    email: string;
  };
  client?: Client;
}

export interface Legislation {
  id: string;
  title: string;
  description?: string;
  assignedAgent?: {
    id: string;
    name: string;
    email: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  };
  retainership?: {
    client?: {
      name: string;
      email: string;
      organizationName?: string; // Added for API compatibility
      clientType: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}
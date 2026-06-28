export interface TimeLog {
  id: string;
  date: string;
  hours: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  taskId: string;
  agentId: string;
  agent: {
    id: string;
    name: string;
    email: string;
    photo?: string;
  };
}
export interface Agent {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  secondaryPhoneNumber: string | null;
  agentType: string;
  executionAgentType?: string | null;
  advisorAgentType?: string | null;
  agentRole: "Execution Agent" | "Advisor Agent" | "Execution & Advisor Agent";
  barAssociationId: string;
  jurisdiction: string;
  specializations: string[];
  photo: string | null;
  superior: Agent | null;
  subordinates: Agent[];
  advisorSubordinates?: Agent[];
  autoAssign?: boolean;
  status: string;
}
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  lastCompletedDate?: string;
  nextDueDate?: string;
  holdDate?: string;
  progress?: number;
  followUpRequired?: boolean;
  followUpDuration?: string; // e.g., '24hr', '48hr', '1w', 'Working'
  statusCheckDuration?: string; // e.g., '24hr', '48hr', '1w', 'Working'
  completed?: boolean;
  recurring?: number | string | null; // Recurring in months (1-12), or string for new format
  createdAt: string;
  updatedAt: string;
  client?: Client;
  createdBy: Agent;
  ownerShipBy?: Agent;
  assignedTo?: Agent;
  category?: {
    id: string;
    name: string;
    description?: string;
    color: string;
    status: string;
  };
  active: boolean;
  comments?: Comment[];
  recurringType?: string;
  legislationId?: string; // Added to link tasks to legislations
  currentPeriodStart?: string;
  legislation?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    triggerDate?: Date | null;
  };
  triggerDate?: string; // <-- Add this line for direct access
  durationAudits?: DurationAudit[];
}
export interface DurationAudit {
  id: string;
  field: string; // "followUpDuration" | "statusCheckDuration"
  oldValue?: string;
  newValue?: string;
  auditDate: string; // "YYYY-MM-DD"
  changedAt: string;
  createdAt: string;
  changedByAgent?: { id: string; name: string };
}
export interface Prospect {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  address?: string;
  leadSource?: string;
  description?: string;
  nextFollowUp?: string;
  lastFollowUp?: string;
  status: string; // e.g., New, Contacted, Qualified, Lost, Converted
  notes?: string;
  assignedTo?: string;
  createdByAgentId?: string;
  service?: string;
  createdByAgent?: {
    id: string;
    name: string;
    email: string;
  };
  amount?: string;
  assignedAgentId?: string;
  assignedAgent?: Agent;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}
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
  createdByUser?: {
    id: string;
    username: string;
    email: string;
  };
  createdByAgent?: {
    currentPeriodStart?: string;
    id: string;
    name: string;
    email: string;
  };
  legislation: {
    id: string;
    title: string;
    description?: string;
    assignedAgentId: string; // Use this for task creation URL
    assignedAgent?: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  client?: Client;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  commentDate?: string;
  startTime?: string;
  endTime?: string;
  taskId: string;
  authorId: string;
  authorType: "USER" | "AGENT";
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentSize?: number;
  attachmentType?: string;
  attachments?: { name: string; url: string; size: number; type: string }[];
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

export interface Client {
  id: string;
  clientType: string;
  email: string;
  phoneNumber: string;
  secondaryPhoneNumber?: string;
  address?: string;
  preferredCommunication?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  idProofType?: string;
  idProofNumber?: string;
  organizationName?: string;
  registrationNumber?: string;
  entityType?: string;
  incorporationDate?: string;
  gstNumber?: string;
  authorizedPersonName?: string;
  designation?: string;
  contactEmail?: string;
  name?: string;
  taskCount?: number;
  statusCounts?: Record<string, number>;
}

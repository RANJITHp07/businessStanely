"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Users,
  FileText,
  MoreHorizontal,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Agent, Task } from "@/types";
import Link from "next/link";

export default function AgentDetails() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentTasks, setAgentTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!id) return;
    const fetchAgent = async () => {
      try {
        const response = await fetch(`/api/agents/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgent(data);
          // Set team members from the agent's subordinates
          if (data.subordinates) {
            setTeamMembers(data.subordinates);
          }
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching agent:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    };

    const fetchAgentTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?assignedToId=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentTasks(data);
        }
      } catch (error) {
        console.error("Error fetching agent tasks:", error);
      } finally {
        setTasksLoading(false);
      }
    };

    fetchAgent();
    fetchAgentTasks();
  }, [id]);

  const getPriorityBadge = (priority: string) => {
    const colors = {
      Low: "bg-green-100 text-green-800 border-green-200",
      Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      High: "bg-red-100 text-red-800 border-red-200",
      low: "bg-green-100 text-green-800 border-green-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      high: "bg-red-100 text-red-800 border-red-200",
    };

    return (
      <Badge
        className={`${
          colors[priority as keyof typeof colors] ||
          "bg-gray-100 text-gray-800 border-gray-200"
        } border`}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      "To Do": "bg-gray-100 text-gray-800 border-gray-200",
      "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
      Completed: "bg-green-100 text-green-800 border-green-200",
      Done: "bg-green-100 text-green-800 border-green-200",
      Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      Overdue: "bg-red-100 text-red-800 border-red-200",
    };

    const icons = {
      "To Do": <Clock className="w-3 h-3 mr-1" />,
      "In Progress": <AlertTriangle className="w-3 h-3 mr-1" />,
      Completed: <CheckCircle className="w-3 h-3 mr-1" />,
      Done: <CheckCircle className="w-3 h-3 mr-1" />,
      Pending: <Clock className="w-3 h-3 mr-1" />,
      Overdue: <AlertTriangle className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge
        className={`${
          colors[status as keyof typeof colors] ||
          "bg-gray-100 text-gray-800 border-gray-200"
        } border`}
      >
        {icons[status as keyof typeof icons] || (
          <Clock className="w-3 h-3 mr-1" />
        )}
        {status}
      </Badge>
    );
  };

  const getAgentTypeBadge = (type: string) => {
    const colors = {
      "Senior Partner": "bg-purple-100 text-purple-800",
      Partner: "bg-blue-100 text-blue-800",
      Associate: "bg-green-100 text-green-800",
      "Junior Associate": "bg-yellow-100 text-yellow-800",
      Paralegal: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge
        className={
          colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }
      >
        {type}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!agent) {
    return notFound();
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Agent Details</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Comprehensive view of agent information and performance
            </p>
          </div>
          <div className="flex justify-end">
            <Link href={`/agent/${agent?.id}/edit`}>
              <Button className="mt-[20px] md:mt-0 w-fit bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                <Edit className="h-4 w-4" />
                Edit Agent
              </Button>
            </Link>
          </div>
        </div>

        {/* Agent Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={agent.photo || ""} />
                <AvatarFallback className="text-lg">
                  {agent.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">{agent.name}</h2>
                  {getAgentTypeBadge(agent.agentType)}
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{agent.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{agent.phoneNumber}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {
                        agentTasks.filter(
                          (task) =>
                            task.status === "Completed" ||
                            task.status === "Done"
                        ).length
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {agentTasks.length > 0
                        ? Math.round(
                            (agentTasks.filter(
                              (task) =>
                                task.status === "Completed" ||
                                task.status === "Done"
                            ).length /
                              agentTasks.length) *
                              100
                          )
                        : 0}
                      %
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Success Rate
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <User className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">Agent Details</p>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <FileText className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              {" "}
              Tasks ({agentTasks.length}){" "}
            </p>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              {" "}
              Team ({teamMembers.length}){" "}
            </p>
          </TabsTrigger>
        </TabsList>

        {/* Agent Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Full Name
                      </label>
                      <p className="font-medium">{agent.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Agent Type
                      </label>
                      <div className="mt-1">
                        {getAgentTypeBadge(agent.agentType)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Email
                      </label>
                      <p className="font-medium">{agent.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Phone
                      </label>
                      <p className="font-medium">{agent.phoneNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Jurisdiction
                      </label>
                      <p className="font-medium">{agent.jurisdiction}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Bar Association ID
                      </label>
                      <p className="font-medium">{agent.barAssociationId}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Specializations */}
              <Card>
                <CardHeader>
                  <CardTitle>Specializations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.specializations.map((spec) => (
                      <Badge key={spec} variant="outline" className="text-sm">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Stats */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Tasks</span>
                      <span className="text-lg font-bold">
                        {agentTasks.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Completed</span>
                      <span className="text-lg font-bold text-green-600">
                        {
                          agentTasks.filter(
                            (task) =>
                              task.status === "Completed" ||
                              task.status === "Done"
                          ).length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pending</span>
                      <span className="text-lg font-bold text-orange-600">
                        {
                          agentTasks.filter(
                            (task) =>
                              task.status === "To Do" ||
                              task.status === "Pending"
                          ).length
                        }
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Completion Rate
                      </span>
                      <span className="text-sm font-bold">
                        {agentTasks.length > 0
                          ? Math.round(
                              (agentTasks.filter(
                                (task) =>
                                  task.status === "Completed" ||
                                  task.status === "Done"
                              ).length /
                                agentTasks.length) *
                                100
                            )
                          : 0}
                        %
                      </span>
                    </div>
                    <Progress
                      value={
                        agentTasks.length > 0
                          ? Math.round(
                              (agentTasks.filter(
                                (task) =>
                                  task.status === "Completed" ||
                                  task.status === "Done"
                              ).length /
                                agentTasks.length) *
                                100
                            )
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
              <CardDescription>
                All tasks currently assigned to {agent.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : agentTasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No tasks assigned to this agent.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-muted-foreground">
                                  {task.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {task.client
                                ? task.client.clientType === "Individual"
                                  ? `${task.client.firstName} ${task.client.lastName}`
                                  : task.client.organizationName
                                : "No Client"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Created: {formatDate(task.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getPriorityBadge(task.priority)}
                          </TableCell>
                          <TableCell>{getStatusBadge(task.status)}</TableCell>
                          <TableCell>
                            {task.dueDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{formatDate(task.dueDate)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                No due date
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {task.status === "Completed" ||
                                  task.status === "Done"
                                    ? "100%"
                                    : task.status === "In Progress"
                                    ? "50%"
                                    : "0%"}
                                </span>
                              </div>
                              <Progress
                                value={
                                  task.status === "Completed" ||
                                  task.status === "Done"
                                    ? 100
                                    : task.status === "In Progress"
                                    ? 50
                                    : 0
                                }
                                className="h-2"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/task/${task.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Task
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/task/${task.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Task
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Team Members</span>
              </CardTitle>
              <CardDescription>
                Team members reporting to {agent.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No team members found for this agent.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Specializations</TableHead>
                        <TableHead>Jurisdiction</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.photo || ""} />
                                <AvatarFallback>
                                  {member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getAgentTypeBadge(member.agentType)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {member.specializations
                                .slice(0, 2)
                                .map((spec) => (
                                  <Badge
                                    key={spec}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {spec}
                                  </Badge>
                                ))}
                              {member.specializations.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{member.specializations.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{member.jurisdiction}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/agent/${member.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Profile
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/agent/${member.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Member
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

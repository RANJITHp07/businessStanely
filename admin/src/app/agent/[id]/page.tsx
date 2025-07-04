"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    User,
    Mail,
    Phone,
    Calendar,
    Building2,
    Users,
    FileText,
    MoreHorizontal,
    Edit,
    Eye,
    ArrowLeft,
    CheckCircle,
    Clock,
    AlertTriangle,
    Star,
    Award,
    TrendingUp,
    UserPlus,
    UserMinus,
} from "lucide-react"

// Mock agent data
const agentData = {
    id: "1",
    name: "John Smith",
    email: "john.smith@lawfirm.com",
    phone: "+1 (555) 123-4567",
    agentType: "Senior Partner",
    specializations: ["Corporate Law", "Tax Law", "Mergers & Acquisitions"],
    jurisdiction: "New York",
    barAssociationId: "NY12345",
    address: "123 Legal Street, New York, NY 10001",
    joinDate: "2020-01-15",
    status: "Active",
    avatar: null,
    bio: "Experienced senior partner with over 15 years in corporate law. Specializes in complex mergers and acquisitions, tax planning, and corporate governance.",
    education: [
        { degree: "J.D.", institution: "Harvard Law School", year: "2008" },
        { degree: "B.A. Economics", institution: "Yale University", year: "2005" },
    ],
    certifications: ["New York State Bar", "Corporate Law Specialist", "Tax Law Certification"],
    stats: {
        totalTasks: 45,
        completedTasks: 38,
        pendingTasks: 7,
        completionRate: 84,
        avgTaskTime: "5.2 days",
        clientSatisfaction: 4.8,
    },
}

// Mock tasks data for the agent
const agentTasks = [
    {
        id: "1",
        taskName: "Contract Review - Acme Corp",
        clientName: "Acme Corporation",
        priority: "high",
        status: "In Progress",
        dueDate: "2024-01-25",
        percentageCompleted: 75,
        category: "Contract Review",
        assignedDate: "2024-01-15",
    },
    {
        id: "2",
        taskName: "M&A Due Diligence - TechStart",
        clientName: "TechStart Inc.",
        priority: "high",
        status: "In Progress",
        dueDate: "2024-02-10",
        percentageCompleted: 45,
        category: "Due Diligence",
        assignedDate: "2024-01-20",
    },
    {
        id: "3",
        taskName: "Tax Planning Consultation",
        clientName: "Global Enterprises",
        priority: "medium",
        status: "Completed",
        dueDate: "2024-01-20",
        percentageCompleted: 100,
        category: "Tax Planning",
        assignedDate: "2024-01-10",
    },
    {
        id: "4",
        taskName: "Corporate Governance Review",
        clientName: "MedCare Solutions",
        priority: "low",
        status: "Pending",
        dueDate: "2024-02-15",
        percentageCompleted: 0,
        category: "Compliance",
        assignedDate: "2024-01-25",
    },
]

// Mock team data
const agentTeam = [
    {
        id: "2",
        name: "Sarah Johnson",
        email: "sarah.johnson@lawfirm.com",
        agentType: "Associate",
        specializations: ["Corporate Law", "Contract Law"],
        status: "Active",
        joinDate: "2022-03-15",
        tasksAssigned: 12,
        completionRate: 92,
        avatar: null,
    },
    {
        id: "3",
        name: "Michael Brown",
        email: "michael.brown@lawfirm.com",
        agentType: "Junior Associate",
        specializations: ["Research", "Document Preparation"],
        status: "Active",
        joinDate: "2023-06-10",
        tasksAssigned: 8,
        completionRate: 88,
        avatar: null,
    },
    {
        id: "4",
        name: "Emily Davis",
        email: "emily.davis@lawfirm.com",
        agentType: "Paralegal",
        specializations: ["Legal Research", "Case Preparation"],
        status: "Active",
        joinDate: "2023-01-08",
        tasksAssigned: 15,
        completionRate: 95,
        avatar: null,
    },
]

export default function AgentDetails() {
    const [activeTab, setActiveTab] = useState("details")

    const getPriorityBadge = (priority: string) => {
        const colors = {
            low: "bg-green-100 text-green-800 border-green-200",
            medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
            high: "bg-red-100 text-red-800 border-red-200",
        }

        return (
            <Badge className={`${colors[priority as keyof typeof colors]} border`}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Badge>
        )
    }

    const getStatusBadge = (status: string) => {
        const colors = {
            Pending: "bg-gray-100 text-gray-800 border-gray-200",
            "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
            Completed: "bg-green-100 text-green-800 border-green-200",
            Overdue: "bg-red-100 text-red-800 border-red-200",
        }

        const icons = {
            Pending: <Clock className="w-3 h-3 mr-1" />,
            "In Progress": <AlertTriangle className="w-3 h-3 mr-1" />,
            Completed: <CheckCircle className="w-3 h-3 mr-1" />,
            Overdue: <AlertTriangle className="w-3 h-3 mr-1" />,
        }

        return (
            <Badge className={`${colors[status as keyof typeof colors]} border`}>
                {icons[status as keyof typeof icons]}
                {status}
            </Badge>
        )
    }

    const getAgentTypeBadge = (type: string) => {
        const colors = {
            "Senior Partner": "bg-purple-100 text-purple-800",
            Partner: "bg-blue-100 text-blue-800",
            Associate: "bg-green-100 text-green-800",
            "Junior Associate": "bg-yellow-100 text-yellow-800",
            Paralegal: "bg-orange-100 text-orange-800",
        }

        return <Badge className={colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"}>{type}</Badge>
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold">Agent Details</h1>
                        <p className="text-muted-foreground mt-2">Comprehensive view of agent information and performance</p>
                    </div>
                    <Button className="flex items-center gap-2">
                        <Edit className="h-4 w-4" />
                        Edit Agent
                    </Button>
                </div>

                {/* Agent Summary Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-start gap-6">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={agentData.avatar || ""} />
                                <AvatarFallback className="text-lg">
                                    {agentData.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-bold">{agentData.name}</h2>
                                    {getAgentTypeBadge(agentData.agentType)}
                                    <Badge variant={agentData.status === "Active" ? "default" : "secondary"}>{agentData.status}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        <span>{agentData.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        <span>{agentData.phone}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-600">{agentData.stats.completedTasks}</div>
                                        <div className="text-xs text-muted-foreground">Completed</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-600">{agentData.stats.completionRate}%</div>
                                        <div className="text-xs text-muted-foreground">Success Rate</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Agent Details
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Tasks ({agentTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="team" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Team ({agentTeam.length})
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
                                            <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                                            <p className="font-medium">{agentData.name}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">Agent Type</label>
                                            <div className="mt-1">{getAgentTypeBadge(agentData.agentType)}</div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">Email</label>
                                            <p className="font-medium">{agentData.email}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">Phone</label>
                                            <p className="font-medium">{agentData.phone}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">Jurisdiction</label>
                                            <p className="font-medium">{agentData.jurisdiction}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">Bar Association ID</label>
                                            <p className="font-medium">{agentData.barAssociationId}</p>
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
                                        {agentData.specializations.map((spec) => (
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
                                            <span className="text-lg font-bold">{agentData.stats.totalTasks}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Completed</span>
                                            <span className="text-lg font-bold text-green-600">{agentData.stats.completedTasks}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Pending</span>
                                            <span className="text-lg font-bold text-orange-600">{agentData.stats.pendingTasks}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Completion Rate</span>
                                            <span className="text-sm font-bold">{agentData.stats.completionRate}%</span>
                                        </div>
                                        <Progress value={agentData.stats.completionRate} className="h-2" />
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
                            <CardDescription>All tasks currently assigned to {agentData.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                                        <div className="font-medium">{task.taskName}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{task.clientName}</div>
                                                    <div className="text-sm text-muted-foreground">Assigned: {formatDate(task.assignedDate)}</div>
                                                </TableCell>
                                                <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                                                <TableCell>{getStatusBadge(task.status)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span>{formatDate(task.dueDate)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">{task.percentageCompleted}%</span>
                                                        </div>
                                                        <Progress value={task.percentageCompleted} className="h-2" />
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
                                                            <DropdownMenuItem>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Task
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit Task
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
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
                            <CardDescription>Team members reporting to {agentData.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Team Member</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Specializations</TableHead>
                                            <TableHead>Tasks Assigned</TableHead>
                                            <TableHead>Completion Rate</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agentTeam.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={member.avatar || ""} />
                                                            <AvatarFallback>
                                                                {member.name
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{member.name}</div>
                                                            <div className="text-sm text-muted-foreground">{member.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getAgentTypeBadge(member.agentType)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {member.specializations.slice(0, 2).map((spec) => (
                                                            <Badge key={spec} variant="outline" className="text-xs">
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
                                                    <div className="text-center">
                                                        <div className="font-medium">{member.tasksAssigned}</div>
                                                        <div className="text-xs text-muted-foreground">tasks</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">{member.completionRate}%</span>
                                                        </div>
                                                        <Progress value={member.completionRate} className="h-2" />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={member.status === "Active" ? "default" : "secondary"}>{member.status}</Badge>
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
                                                            <DropdownMenuItem>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Profile
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit Member
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive">
                                                                <UserMinus className="mr-2 h-4 w-4" />
                                                                Remove from Team
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

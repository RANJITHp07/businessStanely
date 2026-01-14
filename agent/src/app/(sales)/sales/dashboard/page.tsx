"use client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, CalendarIcon, Target, Clock } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts"
import { useAgentContext } from "@/lib/agent-context"

// Mock data for sales dashboard
const dashboardData = {
    leads: {
        total: 284,
        new: 42,
        growth: 15.3,
    },
    closedAmount: {
        amount: 125800,
        growth: 22.5,
    },
    missedFollowups: {
        count: 8,
        growth: -12.5,
    },
    todayLeads: {
        count: 12,
        growth: 8.0,
    },
    todayOpportunities: {
        count: 18,
        value: 45600,
        growth: 18.2,
    },
}

const monthlyRevenueData = [
    { month: "Jan", revenue: 89500 },
    { month: "Feb", revenue: 95200 },
    { month: "Mar", revenue: 108400 },
    { month: "Apr", revenue: 112800 },
    { month: "May", revenue: 118600 },
    { month: "Jun", revenue: 125800 },
]

const leadsSourceData = [
    { source: "Website", count: 120 },
    { source: "Referral", count: 85 },
    { source: "Cold Call", count: 45 },
    { source: "Social", count: 34 },
]

const recentActivities = [
    {
        id: 1,
        type: "New Lead",
        description: "Acme Corp - Enterprise package interest",
        time: "10 mins ago",
        icon: Users,
        color: "text-blue-600",
    },
    {
        id: 2,
        type: "Deal Closed",
        description: "$12,500 - TechStart Solutions",
        time: "1 hour ago",
        icon: DollarSign,
        color: "text-green-600",
    },
    {
        id: 3,
        type: "Followup Missed",
        description: "Reminder: Follow up with Global Industries",
        time: "2 hours ago",
        icon: AlertTriangle,
        color: "text-red-600",
    },
    {
        id: 4,
        type: "Opportunity",
        description: "Digital Ventures showing high interest",
        time: "3 hours ago",
        icon: Target,
        color: "text-purple-600",
    },
]

export default function SalesDashboard() {
    const router = useRouter()
    const agent = useAgentContext()

    const chartConfig = {
        revenue: {
            label: "Revenue",
            color: "hsl(217, 91%, 60%)",
        },
        count: {
            label: "Leads",
            color: "hsl(142, 71%, 45%)",
        },
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="container mx-auto max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-balance text-slate-900">Sales Dashboard</h1>
                        <p className="text-slate-600 mt-2">Track your sales performance and manage your pipeline</p>
                    </div>
                    {
                        agent?.agentType != "Lead Maker" &&
                        <Button
                            size="lg"
                            onClick={() => router.push("/sales/calendar")}
                            className="bg-blue-600 hover:bg-blue-700 gap-2 text-white"
                        >
                            <CalendarIcon className="h-5 w-5" />
                            View Calendar
                        </Button>
                    }
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Leads Card */}
                    <Card className="bg-blue-600 text-white border-0 shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-medium text-white">Total Leads</CardTitle>
                            <Users className="h-10 w-10 text-blue-200" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-white">{dashboardData.leads.total}</div>
                            <div className="flex items-center space-x-2 text-sm mt-2">
                                <Badge className="bg-blue-500/30 text-blue-100 border-blue-300/30">{dashboardData.leads.new} New</Badge>
                            </div>
                            <div className="flex items-center mt-3">
                                <TrendingUp className="h-4 w-4 text-blue-200 mr-1" />
                                <span className="text-sm text-blue-100">+{dashboardData.leads.growth}% from last month</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Amount Closed This Month */}
                    <Card className="bg-emerald-600 text-white border-0 shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-medium text-white">Closed This Month</CardTitle>
                            <DollarSign className="h-10 w-10 text-emerald-200" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-white">
                                ${(dashboardData.closedAmount.amount / 1000).toFixed(1)}K
                            </div>
                            <p className="text-sm text-emerald-100 mt-2">Revenue closed in June</p>
                            <div className="flex items-center mt-3">
                                <TrendingUp className="h-4 w-4 text-emerald-200 mr-1" />
                                <span className="text-sm text-emerald-100">+{dashboardData.closedAmount.growth}% from last month</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Missed Followups */}
                    <Card className="bg-red-600 text-white border-0 shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-medium text-white">Missed Followups</CardTitle>
                            <AlertTriangle className="h-10 w-10 text-red-200" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-white">{dashboardData.missedFollowups.count}</div>
                            <p className="text-sm text-red-100 mt-2">Require immediate attention</p>
                            <div className="flex items-center mt-3">
                                <TrendingDown className="h-4 w-4 text-red-200 mr-1" />
                                <span className="text-sm text-red-100">{dashboardData.missedFollowups.growth}% from last week</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today's Leads */}
                    <Card className="bg-purple-600 text-white border-0 shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-medium text-white">Today's Leads</CardTitle>
                            <Clock className="h-10 w-10 text-purple-200" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-white">{dashboardData.todayLeads.count}</div>
                            <p className="text-sm text-purple-100 mt-2">New leads received today</p>
                            <div className="flex items-center mt-3">
                                <TrendingUp className="h-4 w-4 text-purple-200 mr-1" />
                                <span className="text-sm text-purple-100">+{dashboardData.todayLeads.growth}% from yesterday</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today's Opportunities */}
                    <Card className="bg-amber-600 text-white border-0 shadow-lg lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-medium text-white">Today's Opportunities</CardTitle>
                            <Target className="h-10 w-10 text-amber-200" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-4xl font-bold text-white">{dashboardData.todayOpportunities.count}</div>
                                    <p className="text-sm text-amber-100 mt-2">
                                        Active opportunities worth ${(dashboardData.todayOpportunities.value / 1000).toFixed(1)}K
                                    </p>
                                    <div className="flex items-center mt-3">
                                        <TrendingUp className="h-4 w-4 text-amber-200 mr-1" />
                                        <span className="text-sm text-amber-100">
                                            +{dashboardData.todayOpportunities.growth}% from yesterday
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Monthly Revenue Trend */}
                    <Card className="bg-white border-slate-200 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-slate-900">Monthly Revenue Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ChartContainer config={chartConfig} className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyRevenueData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Line
                                                type="monotone"
                                                dataKey="revenue"
                                                stroke="var(--color-revenue)"
                                                strokeWidth={3}
                                                dot={{ fill: "var(--color-revenue)", r: 4 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Leads by Source */}
                    <Card className="bg-white border-slate-200 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-slate-900">Leads by Source</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ChartContainer config={chartConfig} className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={leadsSourceData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="source" />
                                            <YAxis />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Bar dataKey="count" fill="var(--color-count)" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Activity */}
                <Card className="bg-white border-slate-200 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-900">
                            <Clock className="h-5 w-5" />
                            Recent Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentActivities.map((activity) => (
                                <div
                                    key={activity.id}
                                    className="flex items-center space-x-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200"
                                >
                                    <div className={`p-3 rounded-full bg-white ${activity.color} border border-slate-200`}>
                                        <activity.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {activity.type}
                                            </Badge>
                                            <span className="text-xs text-slate-600">{activity.time}</span>
                                        </div>
                                        <p className="text-sm font-medium mt-1 text-slate-900">{activity.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

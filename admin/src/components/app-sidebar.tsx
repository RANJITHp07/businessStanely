import { Calendar, ClipboardCheck, Home, Inbox, Search, Settings, UserRoundPen, UserSearch } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

// Menu items.
const items = [
    {
        title: "Dashboard",
        url: "/",
        icon: Home,
    },
    {
        title: "Agent",
        url: "/agent",
        icon: UserRoundPen,
    },
    {
        title: "Client",
        url: "/client",
        icon: UserSearch,
    },
    {
        title: "Task",
        url: "/task",
        icon: ClipboardCheck,
    },
    {
        title: "Settings",
        url: "/setting",
        icon: Settings,
    },
]

export function AppSidebar() {
    return (

        <Sidebar >
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xl mb-5 text-white Camelcase">Business Stanely</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>

                                        <a href={item.url}>
                                            <item.icon />
                                            <span className="text-[16px]">{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}
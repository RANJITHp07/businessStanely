'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import React, { useState } from 'react'
import { useAgentContext } from '@/lib/agent-context'
import { hasExecutionRole, hasAdvisorRole, EXECUTION_AND_ADVISOR_AGENT_ROLE } from '@/lib/agentRole'
import { isLeadMaker } from '@/lib/agentType'
import { AddEntryDialog } from '@/app/(dashboard)/timesheet/_component/add-entry-dialog'
import { usePWA } from '@/lib/pwa-context'
import { Download } from 'lucide-react'

export default function Navigator() {
    const router = useRouter()
    const agent = useAgentContext()
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false)
    const { canInstall, install } = usePWA()

    return (
        <div className="hidden md:flex items-center justify-between container mx-auto">

            <Breadcrumb className="flex-1">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <span
                            className="cursor-pointer hover:underline"
                            onClick={() => router.push("/dashboard")}
                        >
                            Dashboard
                        </span>
                    </BreadcrumbItem>

                    {segments.map((segment, index) => {
                        const isLast = index === segments.length - 1

                        const label = decodeURIComponent(segment)
                            .replace(/-/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())

                        return (
                            <React.Fragment key={index}>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    {isLast ? (
                                        <span className="font-medium">
                                            {label}
                                        </span>
                                    ) : (
                                        <span
                                            className="cursor-pointer hover:underline"
                                            onClick={() => router.back()}
                                        >
                                            {label}
                                        </span>
                                    )}
                                </BreadcrumbItem>
                            </React.Fragment>
                        )
                    })}
                </BreadcrumbList>
            </Breadcrumb>

            <div className="absolute right-6 flex items-center gap-2">
                {canInstall && (
                    <Button size="sm" variant="outline" onClick={install} className="gap-1.5">
                        <Download className="h-4 w-4" />
                        Install App
                    </Button>
                )}
                {hasExecutionRole(agent?.agentRole) && (
                    <>
                        <Button size="sm" onClick={() => router.push("/task/create")}>
                            Add Normal Task
                        </Button>
                        <Button size="sm" onClick={() => router.push("/task_category/create")}>
                            Create Service
                        </Button>
                        <Button size="sm" onClick={() => setAddEntryDialogOpen(true)}>
                            Add Time Entry
                        </Button>
                    </>
                )}
                {hasAdvisorRole(agent?.agentRole) && (
                    <>
                        <Button size="sm" onClick={() => router.push("/sales/prospects/add")}>
                            Create Lead
                        </Button>
                        {agent?.agentRole !== EXECUTION_AND_ADVISOR_AGENT_ROLE && !isLeadMaker(agent) && (
                            <Button size="sm" onClick={() => router.push("/sales/calendar")}>
                                View Calendar
                            </Button>
                        )}
                    </>
                )}
            </div>

            <AddEntryDialog
                open={addEntryDialogOpen}
                onOpenChange={setAddEntryDialogOpen}
                onAddEntry={() => {
                    setAddEntryDialogOpen(false)
                }}
            />
        </div >
    )
}
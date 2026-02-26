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
import { AddEntryDialog } from '@/app/(dashboard)/timesheet/_component/add-entry-dialog'

export default function Navigator() {
    const router = useRouter()
    const agent = useAgentContext()
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false)

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
                {agent?.agentRole === "Execution Agent" ? (
                    <>
                        <Button size="sm" onClick={() => router.push("/task/create")}>
                            Add Normal Task
                        </Button>
                        <Button size="sm" onClick={() => router.push("/task_category/create")}>
                            Create Service
                        </Button>
                        {/* <Button size="sm" onClick={() => router.push("/retainership/create")}>
                            Create Retainership
                        </Button> */}
                        <Button size="sm" onClick={() => setAddEntryDialogOpen(true)}>
                            Add Time Entry
                        </Button>
                    </>
                ) : (
                    <>
                        <Button size="sm" onClick={() => router.push("/sales/prospects/add")}>
                            Create Lead
                        </Button>
                        {agent?.agentType !== "Lead Maker" && (
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
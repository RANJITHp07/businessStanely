'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbSeparator,
    BreadcrumbLink,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import React from 'react'
import { useAgentContext } from '@/lib/agent-context'

export default function Navigator() {
    const router = useRouter()
    const agent = useAgentContext()
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)

    return (
        <div className="hidden md:flex items-center justify-between container  mx-auto ">
            {/* Breadcrumbs */}
            <Breadcrumb className="flex-1">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>

                    {segments.map((segment, index) => {
                        const href = '/' + segments.slice(0, index + 1).join('/')
                        const isLast = index === segments.length - 1
                        const label = decodeURIComponent(segment)
                            .replace(/-/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())

                        return (
                            <React.Fragment key={href}>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    {isLast ? (
                                        <span className="font-medium">{label}</span>
                                    ) : (
                                        <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            </React.Fragment>
                        )
                    })}
                </BreadcrumbList>
            </Breadcrumb>

            {/* Right-side buttons */}
            <div className="absolute right-6 flex items-center gap-2">
                {agent?.agentRole === "Execution Agent" ? (
                    <>
                        <Button size="sm" onClick={() => router.push("/task/create")}>
                            Create Task
                        </Button>
                        <Button size="sm" onClick={() => router.push("/task_category/create")}>
                            Create Service
                        </Button>
                        <Button size="sm" onClick={() => router.push("/retainership/create")}>
                            Create Retainership
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
        </div>

    )
}

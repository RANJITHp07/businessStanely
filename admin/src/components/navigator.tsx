'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbLink, BreadcrumbPage } from '@/components/ui/breadcrumb'
import React from 'react'
import { Button } from '@/components/ui/button'

export default function Navigator() {
    const router = useRouter()
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)


    return (
        <div className="hidden md:flex items-center justify-between container mx-auto max-w-7xl">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>

                    {segments.map((segment, index) => {
                        const href = '/' + segments.slice(0, index + 1).join('/')
                        const isLast = index === segments.length - 1
                        const label = decodeURIComponent(segment).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

                        return (
                            <React.Fragment key={href}>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    {isLast ? (
                                        <BreadcrumbPage>{label}</BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            </React.Fragment>
                        )
                    })}
                </BreadcrumbList>
            </Breadcrumb>

            <div className="xl:-mr-20 flex items-center gap-2">
                <Button size="sm" onClick={() => router.push('/task/create')}>
                    Add Normal Task
                </Button>
                <Button size="sm" onClick={() => router.push('/task_category/create')}>
                    Create Service
                </Button>
                <Button size="sm" onClick={() => router.push('/dashboard/prospects/add')}>
                    Create Lead
                </Button>
                <Button size="sm" onClick={() => router.push('/agent/create')}>
                    Create Agent
                </Button>
            </div>
        </div>
    )
}

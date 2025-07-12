'use client'

import { usePathname } from 'next/navigation'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbLink, BreadcrumbPage } from '@/components/ui/breadcrumb'
import React from 'react'

export default function Navigator() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)

    return (
       
<Breadcrumb className="hidden md:block container mx-auto max-w-7xl">
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
    )
}

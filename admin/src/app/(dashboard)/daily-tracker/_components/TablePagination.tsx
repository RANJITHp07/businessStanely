"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAGE_SIZES = [20, 50, 100]

/**
 * Client-side paging over `rows`. `resetKey` sends the table back to page 1
 * when it changes (for example a new date).
 */
export function usePagination<T>(rows: T[], resetKey?: unknown) {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

    useEffect(() => {
        setPage(1)
    }, [resetKey, pageSize])

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const start = (page - 1) * pageSize
    return {
        page,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        total: rows.length,
        start,
        pageRows: rows.slice(start, start + pageSize),
    }
}

export function TablePagination({
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    start,
}: ReturnType<typeof usePagination<unknown>>) {
    if (total <= PAGE_SIZES[0]) return null

    const first = Math.max(1, Math.min(totalPages - 4, page - 2))
    const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => first + i)

    return (
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
                Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_SIZES.map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                                {size} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                {pages.map((n) => (
                    <Button
                        key={n}
                        variant={n === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(n)}
                    >
                        {n}
                    </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

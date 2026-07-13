"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const STORAGE_PREFIX = "table-pagination:"

type StoredPagination = {
    page?: number
    itemsPerPage?: number
}

function readStored(key: string): StoredPagination | null {
    if (typeof window === "undefined") return null
    try {
        const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as StoredPagination
        if (typeof parsed !== "object" || parsed === null) return null
        return parsed
    } catch {
        return null
    }
}

function writeStored(key: string, value: StoredPagination) {
    if (typeof window === "undefined") return
    try {
        window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    } catch {
        // sessionStorage can be unavailable (private mode / quota); pagination just won't persist.
    }
}

/**
 * Pagination state that survives leaving the page and coming back.
 *
 * `key` must be unique per table (e.g. "admin-leads"), since it names the
 * sessionStorage slot. State is kept for the browser session only, so a fresh
 * tab starts on page 1.
 */
export function useTablePage(key: string, defaultItemsPerPage = 20) {
    const [currentPage, setCurrentPageState] = useState(1)
    const [itemsPerPage, setItemsPerPageState] = useState(defaultItemsPerPage)
    const [restored, setRestored] = useState(false)

    // sessionStorage isn't available during SSR, so restore after the first paint
    // to keep the server and client markup in sync.
    useEffect(() => {
        const stored = readStored(key)
        if (stored) {
            if (typeof stored.page === "number" && stored.page > 0) {
                setCurrentPageState(stored.page)
            }
            if (typeof stored.itemsPerPage === "number" && stored.itemsPerPage > 0) {
                setItemsPerPageState(stored.itemsPerPage)
            }
        }
        setRestored(true)
    }, [key])

    const restoredRef = useRef(restored)
    restoredRef.current = restored

    useEffect(() => {
        if (!restored) return
        writeStored(key, { page: currentPage, itemsPerPage })
    }, [key, currentPage, itemsPerPage, restored])

    const setCurrentPage = useCallback((value: number | ((prev: number) => number)) => {
        setCurrentPageState((prev) => {
            const next = typeof value === "function" ? value(prev) : value
            return next > 0 ? next : 1
        })
    }, [])

    const setItemsPerPage = useCallback((value: number | ((prev: number) => number)) => {
        setItemsPerPageState((prev) => (typeof value === "function" ? value(prev) : value))
    }, [])

    /**
     * Clamp a restored page that no longer exists — rows may have been deleted or
     * filtered out while the user was on another screen.
     */
    const clampToTotalPages = useCallback((totalPages: number) => {
        if (!restoredRef.current) return
        setCurrentPageState((prev) => {
            if (totalPages <= 0) return 1
            return prev > totalPages ? totalPages : prev
        })
    }, [])

    return {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        clampToTotalPages,
    }
}

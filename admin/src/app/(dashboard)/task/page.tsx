import React, { Suspense } from 'react'
import TasksTable from './_components/taskTable'

function Task() {
    return (
        <div>
            <Suspense>
                <TasksTable />
            </Suspense>
        </div>
    )
}

export default Task

'use client'

import React, { useState } from 'react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Filter,
  Search
} from 'lucide-react'
import { useRouter } from 'next/navigation' 

const cards = [
  {
    title: 'Total Tasks',
    value: '26',
    percentage: '+5.19%',
    icon: '/task-icons/1.svg',
    color: '#3b82f6',
    data: [
      { name: 'A', value: 20 },
      { name: 'B', value: 35 },
      { name: 'C', value: 25 },
      { name: 'D', value: 40 },
      { name: 'E', value: 30 },
    ],
  },
  {
    title: 'Completed',
    value: '18',
    percentage: '+3.2%',
    icon: '/task-icons/2.svg',
    color: '#10b981',
    data: [
      { name: 'A', value: 15 },
      { name: 'B', value: 22 },
      { name: 'C', value: 19 },
      { name: 'D', value: 25 },
      { name: 'E', value: 21 },
    ],
  },
  {
    title: 'In Progress',
    value: '21',
    percentage: '-1.5%',
    icon: '/task-icons/3.svg',
    color: '#f59e0b',
    data: [
      { name: 'A', value: 12 },
      { name: 'B', value: 10 },
      { name: 'C', value: 9 },
      { name: 'D', value: 11 },
      { name: 'E', value: 8 },
    ],
  },
  {
    title: 'Pending',
    value: '05',
    percentage: '-0.9%',
    icon: '/task-icons/4.svg',
    color: '#ef4444',
    data: [
      { name: 'A', value: 5 },
      { name: 'B', value: 3 },
      { name: 'C', value: 2 },
      { name: 'D', value: 4 },
      { name: 'E', value: 3 },
    ],
  },
]

// Sample task data
const tasksData = [
  {
    id: 'TSK-001',
    client: 'John Doe',
    description: 'Contract Review for Software License Agreement',
    startDate: '2024-01-15',
    completionDate: '2024-01-25',
    assigned: 'Sarah Wilson',
    status: 'completed'
  },
  {
    id: 'TSK-002',
    client: 'Jane Smith',
    description: 'Legal Research for Corporate Merger Documentation',
    startDate: '2024-01-20',
    completionDate: '2024-02-10',
    assigned: 'Michael Johnson',
    status: 'pending'
  },
  {
    id: 'TSK-003',
    client: 'ABC Corp',
    description: 'Draft Employment Contract Templates',
    startDate: '2024-01-25',
    completionDate: '2024-02-15',
    assigned: 'Emily Davis',
    status: 'in-progress'
  },
  {
    id: 'TSK-004',
    client: 'XYZ Ltd',
    description: 'Intellectual Property Filing and Registration',
    startDate: '2024-02-01',
    completionDate: '2024-02-28',
    assigned: 'Robert Brown',
    status: 'completed'
  },
  {
    id: 'TSK-005',
    client: 'Tech Startup',
    description: 'Privacy Policy and Terms of Service Review',
    startDate: '2024-02-05',
    completionDate: '2024-02-20',
    assigned: 'Lisa Anderson',
    status: 'pending'
  }
]

const AreaChartCards = () => {
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const router = useRouter()

  const handleClick = () => {
    router.push("/createtask") 
  }
  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      pending: 'bg-red-100 text-red-800'
    }
    
    const labels = {
      completed: 'Completed',
      'in-progress': 'In Progress',
      pending: 'Pending'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    })
  }

  const filteredTasks = tasksData.filter(task => {
    const matchesSearch = task.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = selectedFilter === 'all' || task.status === selectedFilter
    
    return matchesSearch && matchesFilter
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTasks = filteredTasks.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div className="space-y-8 p-4">
      {/* Top Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div
            key={index}
            className="rounded-[24px] bg-white shadow-md p-[20px] flex flex-col justify-between"
          >
            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-[16px] text-black">{card.title}</h2>
              <div className="bg-gray-100 p-2 rounded-full">
                <div className="w-[30px] h-[30px] bg-gray-300 rounded flex items-center justify-center text-xs">
                  📊
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[100px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.data}>
                  <defs>
                    <linearGradient id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={card.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={card.color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={card.color}
                    strokeWidth={3}
                    fill={`url(#color${index})`}
                    dot={false}
                  />
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Footer */}
            <div className="flex items-end justify-between mt-4">
              <span className="text-3xl font-bold text-black">{card.value}</span>
              <span
                className={`text-sm ${
                  card.percentage.startsWith('+') ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {card.percentage}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Action Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-[28px] font-bold text-black">Task Management</p>
          <p className="text-[14px] text-black">Manage and track your legal tasks</p>
        </div>

        <button
      onClick={handleClick}
      className="flex items-center gap-2 px-[16px] py-[10px] font-semibold text-white rounded-[8px] cursor-pointer bg-[#003459] hover:bg-[#003459] transition-all duration-200"
    >
      <Plus size={20} />
      Add New Task
    </button>
      </div>

      {/* Task Table Section */}
      <div className="space-y-6">
        {/* Table Actions */}
        <div className="flex flex-col md:flex-row justify-end md:items-center  gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Tasks Table with Horizontal Scroll */}
        <div className="rounded-md border bg-white shadow-sm">
  <div className="w-full lg:overflow-x-visible overflow-x-auto">
    <div className="min-w-[1000px] lg:min-w-full">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-[#003459] text-white">
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Task ID</th>
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Client</th>
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Description</th>
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Start Date</th>
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Completion Date</th>
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left text-[14px] font-semibold whitespace-nowrap">Assigned</th>
            <th className="px-4 py-3 text-right text-[14px] font-semibold whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentTasks.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                No tasks found matching your criteria.
              </td>
            </tr>
          ) : (
            currentTasks.map((task) => (
              <tr key={task.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{task.id}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{task.client}</div>
                </td>
                <td className="px-4 py-3">
                  <div
                    className="text-sm text-gray-900 max-w-xs truncate"
                    title={task.description}
                  >
                    {task.description}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{formatDate(task.startDate)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{formatDate(task.completionDate)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(task.status)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{task.assigned}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="relative group">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                      <MoreHorizontal className="h-4 w-4 text-gray-500" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      <div className="py-1">
                        <button className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                          <Eye className="mr-3 h-4 w-4" />
                          View Details
                        </button>
                        <button className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                          <Edit className="mr-3 h-4 w-4" />
                          Edit Task
                        </button>
                        <hr className="my-1" />
                        <button
                          className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                          onClick={() => setTaskToDelete(task)}
                        >
                          <Trash2 className="mr-3 h-4 w-4" />
                          Delete Task
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>

  {/* Pagination */}
  {filteredTasks.length > 0 && (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-gray-50 gap-4">
      <div className="text-sm text-gray-700">
        Showing {startIndex + 1} to {Math.min(endIndex, filteredTasks.length)} of {filteredTasks.length} results
      </div>
      <div className="flex items-center space-x-2 flex-wrap justify-center">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm text-black border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`px-3 py-1 text-sm border rounded-md ${
              currentPage === page
                ? 'bg-[#003459] text-white'
                : 'border-gray-300 hover:bg-gray-100 text-black'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border text-black border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )}
</div>


      </div>
    </div>
  )
}

export default AreaChartCards
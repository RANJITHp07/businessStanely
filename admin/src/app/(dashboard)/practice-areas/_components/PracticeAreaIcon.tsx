import {
    Building2,
    FileText,
    Gavel,
    Globe2,
    Landmark,
    Receipt,
    TrendingUp,
    Users,
    type LucideIcon,
} from "lucide-react"

/* Same icon set the website draws on its practice area cards
   (business-plus(blue theme)/components/Features.tsx). */
const ICONS: Record<string, LucideIcon> = {
    building: Building2,
    landmark: Landmark,
    globe: Globe2,
    users: Users,
    receipt: Receipt,
    fileText: FileText,
    trending: TrendingUp,
    gavel: Gavel,
}

export default function PracticeAreaIcon({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
    const Icon = ICONS[icon] ?? Building2
    return <Icon className={className} />
}

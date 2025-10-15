
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, MessageSquare, UtensilsCrossed, Shuffle, UserX } from "lucide-react"

// Mock activity data
const mockActivities = [
  {
    id: 1,
    type: "no-show",
    user: "admin@example.com",
    action: "Marked Bob Smith as no-show",
    target: "Bob Smith",
    timestamp: "2025-01-14T11:30:00",
    details: "Status changed from attending to no-show",
  },
  {
    id: 2,
    type: "comment",
    user: "manager@example.com",
    action: "Added comment to David Brown",
    target: "David Brown",
    timestamp: "2025-01-14T10:15:00",
    details: "Comment: VIP guest",
  },
  {
    id: 3,
    type: "restaurant",
    user: "admin@example.com",
    action: "Updated restaurant details",
    target: "La Bella Vista",
    timestamp: "2025-01-14T09:45:00",
    details: "Updated menu link and comments",
  },
  {
    id: 4,
    type: "shuffle",
    user: "admin@example.com",
    action: "Shuffled table assignments",
    target: "All attendees",
    timestamp: "2025-01-14T08:00:00",
    details: "290 people assigned to 26 restaurants",
  },
  {
    id: 5,
    type: "restaurant",
    user: "admin@example.com",
    action: "Added new restaurant",
    target: "The Steakhouse",
    timestamp: "2025-01-13T16:30:00",
    details: "Restaurant added with full details",
  },
  {
    id: 6,
    type: "comment",
    user: "admin@example.com",
    action: "Added comment to Sushi Palace",
    target: "Sushi Palace",
    timestamp: "2025-01-13T15:20:00",
    details: "Comment: Fresh sushi, no pork",
  },
]

const getActivityIcon = (type: string) => {
  switch (type) {
    case "no-show":
      return <UserX className="h-4 w-4 text-destructive" />
    case "comment":
      return <MessageSquare className="h-4 w-4 text-primary" />
    case "restaurant":
      return <UtensilsCrossed className="h-4 w-4 text-accent" />
    case "shuffle":
      return <Shuffle className="h-4 w-4 text-warning" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

const getActivityBadge = (type: string) => {
  switch (type) {
    case "no-show":
      return <Badge variant="destructive">No-Show</Badge>
    case "comment":
      return <Badge variant="default">Comment</Badge>
    case "restaurant":
      return <Badge variant="outline">Restaurant</Badge>
    case "shuffle":
      return <Badge className="bg-warning text-warning-foreground">Shuffle</Badge>
    default:
      return <Badge variant="secondary">Activity</Badge>
  }
}

export function ActivityLog() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Activity Log</h2>
        <p className="text-muted-foreground">Audit trail of all changes with timestamps and user info</p>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>All changes are tracked with user attribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockActivities.map((activity, index) => (
              <div key={activity.id} className="relative">
                {/* Timeline line */}
                {index !== mockActivities.length - 1 && (
                  <div className="absolute left-5 top-10 h-full w-px bg-border" />
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
                    {getActivityIcon(activity.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2 pb-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{activity.action}</p>
                          {getActivityBadge(activity.type)}
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.details}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {activity.user}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

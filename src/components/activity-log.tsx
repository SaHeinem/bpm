import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Clock, User, MessageSquare, UtensilsCrossed, Shuffle, UserX, AlertCircle } from "lucide-react"

import { useActivityLog } from "@/hooks/use-activity-log"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ICONS: Record<string, ReactNode> = {
  participant: <User className="h-4 w-4 text-primary" />,
  assignment: <Shuffle className="h-4 w-4 text-warning" />,
  restaurant: <UtensilsCrossed className="h-4 w-4 text-accent" />,
  captain: <UserX className="h-4 w-4 text-destructive" />,
  note: <MessageSquare className="h-4 w-4 text-primary" />,
}

const BADGES: Record<string, ReactNode> = {
  participant: <Badge variant="outline">Participant</Badge>,
  assignment: <Badge className="bg-warning text-warning-foreground">Assignment</Badge>,
  restaurant: <Badge variant="secondary">Restaurant</Badge>,
  captain: <Badge variant="destructive">Captain</Badge>,
  note: <Badge variant="outline">Note</Badge>,
}

type FilterType = "all" | "participant" | "assignment" | "restaurant" | "captain" | "note"

export function ActivityLog() {
  const { activityLog, isLoading, refetch } = useActivityLog()
  const [filter, setFilter] = useState<FilterType>("all")

  const filteredLog = useMemo(() => {
    if (filter === "all") {
      return activityLog
    }
    return activityLog.filter((entry) => entry.event_type === filter)
  }, [activityLog, filter])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Activity Log</h2>
          <p className="text-muted-foreground">Every action on the Blind Peering event is captured here.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              <SelectItem value="participant">Participants</SelectItem>
              <SelectItem value="assignment">Assignments</SelectItem>
              <SelectItem value="restaurant">Restaurants</SelectItem>
              <SelectItem value="captain">Captains</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="bg-transparent" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Automatic audit trail of assignments, edits, and imports.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : filteredLog.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No activity yet</AlertTitle>
              <AlertDescription>
                Actions such as assignments, imports, and restaurant changes will appear here automatically.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {filteredLog.map((entry, index) => {
                const icon = ICONS[entry.event_type] ?? <Clock className="h-4 w-4 text-muted-foreground" />
                const badge = BADGES[entry.event_type] ?? <Badge variant="secondary">Activity</Badge>
                const timestamp = new Date(entry.created_at).toLocaleString()

                return (
                  <div key={entry.id} className="relative">
                    {index !== filteredLog.length - 1 && <div className="absolute left-5 top-10 h-full w-px bg-border" />}
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
                        {icon}
                      </div>
                      <div className="flex-1 space-y-2 pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{entry.description}</p>
                              {badge}
                            </div>
                            {entry.metadata && (
                              <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                                {JSON.stringify(entry.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{timestamp}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          {entry.actor && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.actor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shuffle, Users, UtensilsCrossed, UserX } from "lucide-react"
import { ShuffleWarningDialog } from "@/components/shuffle-warning-dialog"

export function DashboardOverview() {
  const [showShuffleDialog, setShowShuffleDialog] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)

  // Mock data - replace with real data from API
  const stats = {
    totalPeople: 290,
    confirmedPeople: 267,
    noShows: 23,
    totalRestaurants: 26,
    averagePerTable: 11,
    lastShuffled: isShuffled ? new Date().toLocaleString() : null,
  }

  const handleShuffle = () => {
    if (isShuffled) {
      setShowShuffleDialog(true)
    } else {
      performShuffle()
    }
  }

  const performShuffle = () => {
    // Call your edge function here
    console.log("Shuffling attendees...")
    setIsShuffled(true)
    setShowShuffleDialog(false)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Shuffle Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Event Dashboard</h2>
          <p className="text-muted-foreground">Manage your Blind Peering event</p>
        </div>
        <Button size="lg" onClick={handleShuffle} className="gap-2">
          <Shuffle className="h-4 w-4" />
          {isShuffled ? "Re-shuffle Tables" : "Shuffle Tables"}
        </Button>
      </div>

      {/* Status Alert */}
      {isShuffled && (
        <Card className="border-success/50 bg-success/10">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
              <Shuffle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">Tables have been shuffled</p>
              <p className="text-sm text-muted-foreground">Last shuffled: {stats.lastShuffled}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total People</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPeople}</div>
            <p className="text-xs text-muted-foreground">From external API</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.confirmedPeople}</div>
            <p className="text-xs text-muted-foreground">Will attend event</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Shows</CardTitle>
            <UserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noShows}</div>
            <p className="text-xs text-muted-foreground">Marked as won't come</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRestaurants}</div>
            <p className="text-xs text-muted-foreground">~{stats.averagePerTable} people per table</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for event management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
              <a href="/people">
                <Users className="mr-2 h-4 w-4" />
                Manage People & No-Shows
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
              <a href="/restaurants">
                <UtensilsCrossed className="mr-2 h-4 w-4" />
                Add/Edit Restaurants
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
              <a href="/assignments">
                <Shuffle className="mr-2 h-4 w-4" />
                View Assignments
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Status</CardTitle>
            <CardDescription>Current state of the event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Shuffle Status</span>
              <Badge variant={isShuffled ? "default" : "secondary"}>{isShuffled ? "Completed" : "Not Started"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Attendance Rate</span>
              <Badge variant="outline">{Math.round((stats.confirmedPeople / stats.totalPeople) * 100)}%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tables Ready</span>
              <Badge variant="outline">{stats.totalRestaurants} / 26</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <ShuffleWarningDialog open={showShuffleDialog} onOpenChange={setShowShuffleDialog} onConfirm={performShuffle} />
    </div>
  )
}

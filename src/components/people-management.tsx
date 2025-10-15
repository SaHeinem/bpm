
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, UserX, MessageSquare, RefreshCw } from "lucide-react"

// Mock data - replace with real API data
const mockPeople = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    noShow: false,
    restaurant: "La Bella Vista",
    comments: "",
    lastUpdated: "2025-01-14T10:30:00",
    updatedBy: "admin@example.com",
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@example.com",
    noShow: true,
    restaurant: null,
    comments: "Called to cancel",
    lastUpdated: "2025-01-14T09:15:00",
    updatedBy: "admin@example.com",
  },
  {
    id: 3,
    name: "Carol White",
    email: "carol@example.com",
    noShow: false,
    restaurant: "Sushi Palace",
    comments: "",
    lastUpdated: "2025-01-14T08:00:00",
    updatedBy: "system",
  },
  {
    id: 4,
    name: "David Brown",
    email: "david@example.com",
    noShow: false,
    restaurant: "The Steakhouse",
    comments: "VIP guest",
    lastUpdated: "2025-01-13T16:45:00",
    updatedBy: "manager@example.com",
  },
  {
    id: 5,
    name: "Emma Davis",
    email: "emma@example.com",
    noShow: false,
    restaurant: "La Bella Vista",
    comments: "",
    lastUpdated: "2025-01-14T11:20:00",
    updatedBy: "system",
  },
]

export function PeopleManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [people, setPeople] = useState(mockPeople)
  const [selectedPerson, setSelectedPerson] = useState<(typeof mockPeople)[0] | null>(null)
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [newComment, setNewComment] = useState("")

  const filteredPeople = people.filter(
    (person) =>
      person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleNoShowToggle = (personId: number) => {
    setPeople(
      people.map((person) =>
        person.id === personId
          ? { ...person, noShow: !person.noShow, lastUpdated: new Date().toISOString(), updatedBy: "admin@example.com" }
          : person,
      ),
    )
  }

  const handleAddComment = () => {
    if (selectedPerson && newComment.trim()) {
      setPeople(
        people.map((person) =>
          person.id === selectedPerson.id
            ? { ...person, comments: newComment, lastUpdated: new Date().toISOString(), updatedBy: "admin@example.com" }
            : person,
        ),
      )
      setNewComment("")
      setCommentDialogOpen(false)
      setSelectedPerson(null)
    }
  }

  const syncFromAPI = () => {
    console.log("Syncing people from external API...")
    // Implement API sync logic
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">People Management</h2>
          <p className="text-muted-foreground">Manage attendees and track no-shows</p>
        </div>
        <Button onClick={syncFromAPI} variant="outline" className="gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Sync from API
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{people.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{people.filter((p) => !p.noShow).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">No-Shows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{people.filter((p) => p.noShow).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search People</CardTitle>
          <CardDescription>Find attendees by name or email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* People List */}
      <Card>
        <CardHeader>
          <CardTitle>Attendees ({filteredPeople.length})</CardTitle>
          <CardDescription>Manage attendance status and add comments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPeople.map((person) => (
              <div
                key={person.id}
                className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                  person.noShow ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-medium ${person.noShow ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {person.name}
                    </p>
                    {person.noShow && (
                      <Badge variant="destructive" className="gap-1">
                        <UserX className="h-3 w-3" />
                        No-Show
                      </Badge>
                    )}
                    {person.comments && (
                      <Badge variant="outline" className="gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Has comment
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{person.email}</p>
                  {person.restaurant && !person.noShow && (
                    <p className="text-sm text-primary">Assigned to: {person.restaurant}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(person.lastUpdated).toLocaleString()} by {person.updatedBy}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPerson(person)
                      setNewComment(person.comments)
                      setCommentDialogOpen(true)
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">No-Show</span>
                    <Switch checked={person.noShow} onCheckedChange={() => handleNoShowToggle(person.id)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
            <DialogDescription>Add notes about {selectedPerson?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Enter your comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddComment}>Save Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
